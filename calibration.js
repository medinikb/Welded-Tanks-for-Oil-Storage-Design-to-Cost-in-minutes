(function(global){
  "use strict";

  const MODEL_VERSION = "10.2.0-dual-mode-class3";

  // TankM v9 global owner-side completion model, trained on 11 NREP tank families.
  // Features: Core MTO MT, plan area m2, hot service (>93 C), IFR flag, EFR flag.
  const GLOBAL_MODEL = {
    n: 11,
    alpha: 1,
    featureNames: ["Core MTO MT","Plan area m2","Hot >93C","IFR","EFR"],
    means: [349.05296315217043,935.1771631489936,0.5454545454545454,0.2727272727272727,0.09090909090909091],
    sds: [227.2979444598115,647.3784480023113,0.5222329678670935,0.46709936649691375,0.30151134457776363],
    beta: [484.8429090909091,142.04725836807268,129.58610748793996,19.400231599165,40.21264078340457,-0.6253341332184199],
    method: "Ridge regression on standardized features",
    validation: {
      loocvMapePct: 9.566647860467352,
      repeated3FoldMedianMapePct: 11.717538626279229,
      bootstrapOobMedianMapePct: 10.110117958484539,
      crossProjectPhaseMapePct: [18.154719197838006,27.794149095552534]
    },
    governance: "Empirical completion layer only. It never changes API/code/project plate thickness."
  };

  // Local calibration anchor derived from the supplied As-Built GA.
  // It is deliberately anonymized in code and must be treated as calibration data,
  // not independent external validation after inclusion in the calibration set.
  const IFR_SMALL_ANCHOR = {
    id: "IFR-20M-CAL-01",
    roofType: "ifr",
    diameterM: 20.0,
    shellHeightM: 14.5,
    designLevelM: 11.72,
    designSG: 0.79,
    designTempC: 65,
    planAreaM2: Math.PI * 100,
    coreMtoMT: 106.40921983673917,
    actualEmptyWeightMT: 142.0,
    sourceBasis: "As-Built GA calibration anchor",
    calibrationStatus: "IN_SAMPLE_CALIBRATION"
  };

  function n(v, fallback=0){
    const x=Number(v);
    return Number.isFinite(x)?x:fallback;
  }
  function clamp(x,a,b){ return Math.min(Math.max(x,a),b); }

  function featureVector(input, coreMtoMT){
    const D=n(input.diameter);
    return [
      n(coreMtoMT),
      Math.PI*Math.pow(D/2,2),
      n(input.designTemp)>93?1:0,
      input.roofType==="ifr"?1:0,
      input.roofType==="efr"?1:0
    ];
  }

  function globalPredictionFromFeatures(x){
    const m=GLOBAL_MODEL;
    let p=m.beta[0];
    for(let i=0;i<m.featureNames.length;i++){
      p += m.beta[i+1]*((n(x[i])-m.means[i])/m.sds[i]);
    }
    return p;
  }

  function globalPrediction(input, coreMtoMT){
    return globalPredictionFromFeatures(featureVector(input, coreMtoMT));
  }

  const ANCHOR_GLOBAL_PREDICTION = globalPredictionFromFeatures([
    IFR_SMALL_ANCHOR.coreMtoMT,
    IFR_SMALL_ANCHOR.planAreaM2,
    0,1,0
  ]);
  const ANCHOR_RESIDUAL_MT = IFR_SMALL_ANCHOR.actualEmptyWeightMT - ANCHOR_GLOBAL_PREDICTION;

  function localAnchorWeight(input, coreMtoMT){
    if(input.roofType!=="ifr") return 0;
    const D=n(input.diameter);
    // Smoothly fades the new small-IFR calibration to zero by 30 m diameter.
    // Core-MTO similarity prevents a geometry-only correction from dominating
    // an unusually heavy or unusually light tank.
    const diameterWeight=clamp((30-D)/10,0,1);
    const coreSigma=120;
    const coreWeight=Math.exp(-0.5*Math.pow((n(coreMtoMT)-IFR_SMALL_ANCHOR.coreMtoMT)/coreSigma,2));
    return diameterWeight*coreWeight;
  }

  function domainStatus(input, coreMtoMT){
    const D=n(input.diameter), core=n(coreMtoMT);
    const issues=[];
    if(D<19 || D>53) issues.push("diameter outside 11-family global calibration span");
    if(String(input.calculationMode||"governed")==="class3-screening" && D>61) issues.push("large-diameter Class 3 extrapolation: completion model is outside calibration geometry");
    if(core<100 || core>800) issues.push("core MTO outside/near edge of global calibration span");
    if(input.roofType==="ifr" && D<=25) issues.push("small-IFR local calibration zone has one anchor only");
    if(input.roofType==="efr" && input.floatingRoofSubtype==="double") issues.push("double-deck EFR is not represented by the global 11-family roof feature");
    return {
      status: issues.length?"REVIEW":"IN_DOMAIN",
      issues
    };
  }

  function predictCompleteWeight(input, coreMtoMT){
    const core=n(coreMtoMT);
    const globalPred=globalPrediction(input,core);
    const w=localAnchorWeight(input,core);
    const adjusted=Math.max(core, globalPred + w*ANCHOR_RESIDUAL_MT);
    const domain=domainStatus(input,core);
    let mode="GLOBAL_RIDGE";
    if(w>=0.75) mode="LOCAL_IFR_ANCHOR_DOMINANT";
    else if(w>0.05) mode="GLOBAL_PLUS_LOCAL_IFR_BLEND";
    return {
      modelVersion: MODEL_VERSION,
      coreMtoMT: core,
      globalPredictionMT: globalPred,
      localAnchorWeight: w,
      localAnchorCorrectionMT: w*ANCHOR_RESIDUAL_MT,
      predictedEmptyWeightMT: adjusted,
      completionUpliftMT: adjusted-core,
      completionUpliftPct: core>0?(adjusted/core-1)*100:null,
      mode,
      domain,
      anchor: IFR_SMALL_ANCHOR,
      anchorGlobalPredictionMT: ANCHOR_GLOBAL_PREDICTION,
      anchorResidualMT: ANCHOR_RESIDUAL_MT,
      governance: "The 20 m IFR tank is now a calibration anchor and is no longer an independent external validation point."
    };
  }

  const api={
    MODEL_VERSION, GLOBAL_MODEL, IFR_SMALL_ANCHOR,
    ANCHOR_GLOBAL_PREDICTION, ANCHOR_RESIDUAL_MT,
    featureVector, globalPredictionFromFeatures, globalPrediction,
    localAnchorWeight, domainStatus, predictCompleteWeight
  };

  global.TankMCalibration=api;
  if(typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
