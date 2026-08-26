(function(global){
  "use strict";

  const VERSION="10.2.0-dual-mode-class3";
  const CODE_BASIS="API 650 12th Edition (2013), Addendum 3 (2018)";
  const STEEL_DENSITY_DEFAULT=7850;
  const DEFAULT_SHELL_MATERIAL="A537M-C1";
  const DEFAULT_SHELL_GROUP="VI";

  const materials={
    "A36M":{label:"ASTM A36M",fy:250,fu:400,sd:160,st:171},
    "A516M-380":{label:"ASTM A516M Grade 380 (55)",fy:205,fu:380,sd:137,st:154},
    "A516M-415":{label:"ASTM A516M Grade 415 (60)",fy:220,fu:415,sd:147,st:165},
    "A516M-450":{label:"ASTM A516M Grade 450 (65)",fy:240,fu:450,sd:160,st:180},
    "A516M-485":{label:"ASTM A516M Grade 485 (70)",fy:260,fu:485,sd:173,st:195},
    "A537M-C1":{label:"ASTM A537M Class 1, t <= 65 mm",fy:345,fu:485,sd:194,st:208,group:"VI",groupLocked:true},
    "NAT-250":{label:"National Standard Grade 250",fy:250,fu:400,sd:157,st:171},
    "NAT-275":{label:"National Standard Grade 275",fy:275,fu:430,sd:167,st:184}
  };
  const groups=["","I","II","IIA","III","IIIA","IV","IVA","V","VI","VIA"];

  function materialGroupFor(key){return materials[key]?.group||"";}
  function resolveMaterialGroup(key,requestedGroup=""){return materialGroupFor(key)||String(requestedGroup||"");}
  function isMaterialGroupLocked(key){return !!materials[key]?.groupLocked;}
  const DEFAULT_PLATE_SERIES=[6,8,10,12,14,16,18,20,22,24,28,32];
  const COST_DATA=global.TankMCostData||null;
  const RAW_STEEL_RATES=COST_DATA?Object.fromEntries(Object.entries(COST_DATA.RAW_STEEL_RATES).map(([y,v])=>[Number(y),v.recommended])):{2021:64.75,2022:70.9,2023:57.4,2024:52.2,2025:55.05,2026:56.5};
  const POOLED_IDIOT_INDEX=COST_DATA?COST_DATA.FACTORS.materialSupply:2.1469839411750753;
  const BASE_COMPLETE_IDIOT_INDEX=COST_DATA?COST_DATA.FACTORS.baseComplete:4.7710754248417135;
  const INSTALLED_REFERENCE_IDIOT_INDEX=COST_DATA?COST_DATA.FACTORS.installedReference:4.802926688446918;
  const CLASS3_LOW_PCT=-20;
  const CLASS3_HIGH_PCT=30;
  const SCREENING_MAX_DIAMETER_M=80;
  const DOUBLE_DECK_EFR_SCREENING_KGM2=115.8;

  function n(v,fallback=0){ const x=Number(v); return Number.isFinite(x)?x:fallback; }
  function clamp(x,a,b){ return Math.min(Math.max(x,a),b); }
  function roundUp(x,step){
    if(!Number.isFinite(x)) return null;
    const s=n(step,1)>0?n(step,1):1;
    return Math.ceil((x-1e-9)/s)*s;
  }
  function interp(x,x0,y0,x1,y1){ return x1===x0?y0:y0+(x-x0)*(y1-y0)/(x1-x0); }
  function pct(a,b){ return b?100*(a-b)/b:null; }
  function steelWeightMT(areaM2,thicknessMm,density=STEEL_DENSITY_DEFAULT){
    return n(areaM2)*n(thicknessMm)/1000*n(density)/1000;
  }
  function parsePlateSeries(v){
    if(Array.isArray(v)) return v.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    const arr=String(v||"").split(/[ ,;|]+/).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    return arr.length?Array.from(new Set(arr)):DEFAULT_PLATE_SERIES.slice();
  }
  function nextSeriesThickness(required,series,fallbackStep){
    if(!Number.isFinite(required)) return null;
    const s=parsePlateSeries(series);
    const hit=s.find(x=>x+1e-9>=required);
    return hit!=null?hit:roundUp(required,fallbackStep||2);
  }

  function minShellThickness(d){
    if(d<15) return 5;
    if(d<36) return 6;
    if(d<=60) return 8;
    return 10;
  }

  function tempReductionFactor(fy,tempC){
    if(tempC<=93) return 1;
    const t=clamp(tempC,94,260);
    let pts;
    if(fy<310) pts=[[94,.91],[150,.88],[200,.85],[260,.80]];
    else if(fy<380) pts=[[94,.88],[150,.81],[200,.75],[260,.70]];
    else pts=[[94,.92],[150,.87],[200,.83],[260,.79]];
    if(t<=pts[0][0]) return pts[0][1];
    for(let i=0;i<pts.length-1;i++) if(t<=pts[i+1][0]) return interp(t,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]);
    return pts[pts.length-1][1];
  }

  function materialAllowables(key,tempC){
    const m=materials[key];
    if(!m) return null;
    let sd=m.sd, factor=1, annexM=false;
    if(tempC>93){
      annexM=true;
      factor=tempReductionFactor(m.fy,tempC);
      sd=Math.min(m.sd,(2/3)*m.fy*factor);
    }
    return {...m,sdAmbient:m.sd,sd,st:m.st,reductionFactor:factor,annexM};
  }

  function dmtNoImpactTemp(group,t){
    const x=n(t,NaN);
    if(!group||!Number.isFinite(x)) return {status:"REVIEW",value:null,note:"Material group not confirmed."};
    let y=null,valid=true;
    switch(group){
      case "I": if(x>=6&&x<13)y=.714*x-16.286; else if(x>=13&&x<=25)y=1.417*x-25.417; else valid=false; break;
      case "II": if(x>=6&&x<13)y=.634*x-31.81; else if(x>=13&&x<=40)y=1.243*x-39.72; else valid=false; break;
      case "IIA": if(x>=10&&x<13)y=2.667*x-55.667; else if(x>=13&&x<19)y=2*x-47; else if(x>=19&&x<=40)y=.905*x-26.19; else valid=false; break;
      case "III": if(x>=6&&x<=13)y=-40; else if(x>13&&x<=40)y=1.222*x-55.89; else valid=false; break;
      case "IIIA": if(x>=6&&x<=40)y=-40; else valid=false; break;
      case "IV": if(x>=6&&x<=45)y=.7059*x-18.235; else valid=false; break;
      case "IVA": if(x>=6&&x<=45)y=.7353*x-23.412; else valid=false; break;
      case "V": if(x>=6&&x<=45)y=.6176*x-31.71; else valid=false; break;
      case "VI":
      case "VIA": if(x>=6&&x<=45)y=.4112*x-40.471; else valid=false; break;
      default: valid=false;
    }
    return valid?{status:"OK",value:y,note:"Screening value from embedded material-group equation."}:{status:"REVIEW",value:null,note:"Thickness outside embedded DMT equation range."};
  }

  function scopeGates(input){
    const D=n(input.diameter),temp=n(input.designTemp),pi=n(input.internalPressure),pe=n(input.externalPressure);
    const class3=String(input.calculationMode||"governed")==="class3-screening";
    const gates=[];
    const methodWithin=D>0&&D<=61;
    let methodDetail;
    if(methodWithin) methodDetail="SI 1-foot shell method within TankM governed diameter range.";
    else if(class3&&D>61&&D<=SCREENING_MAX_DIAMETER_M) methodDetail=`D = ${D.toFixed(2)} m exceeds 61 m. Detailed shell design is HOLD. Class 3 mode may continue with a clearly labelled non-code 1-foot-equation weight proxy up to ${SCREENING_MAX_DIAMETER_M} m.`;
    else methodDetail=`D = ${D.toFixed(2)} m exceeds TankM governed 1-foot range. Use VDP or elastic analysis; no shell-design release is permitted.`;
    gates.push({id:"method",severity:methodWithin?"OK":"HOLD",title:"Shell design method",detail:methodDetail});
    gates.push({id:"temp",severity:temp<=260?"OK":"HOLD",title:"Temperature",detail:temp<=93?"Annex M stress reduction not triggered.":temp<=260?"Annex M stress reduction applied to product design allowable stress.":"Temperature exceeds implemented range."});
    gates.push({id:"pressure",severity:pi<=18?"OK":"HOLD",title:"Internal pressure",detail:pi<=18?"Within current Annex F screening range; detailed roof/uplift closure remains separate.":"Internal pressure exceeds current API 650 Annex F implementation range."});
    gates.push({id:"external",severity:pe<=0.25?"OK":"REVIEW",title:"External pressure",detail:pe<=0.25?"No detailed Annex V calculation triggered by this screening gate.":"Annex V detailed external-pressure design is not implemented."});
    gates.push({id:"seismic",severity:input.seismic?"REVIEW":"OK",title:"Seismic",detail:input.seismic?"Annex E is required. this release records the input and keeps detailed seismic design as a governance closure item.":"Annex E not selected."});
    gates.push({id:"roof",severity:"REVIEW",title:"Roof system",detail:input.roofType==="ifr"?"IFR plus fixed-roof MTO is modeled; detailed Annex H buoyancy/member design remains REVIEW.":input.roofType==="efr"?"EFR MTO is modeled from an entered or screening dead-load basis; detailed Annex C buoyancy/member design remains REVIEW.":"Fixed-roof plate and structure MTO are modeled; rafter/girder/column member design remains REVIEW."});
    gates.push({id:"nozzle",severity:"REVIEW",title:"Openings",detail:"Nozzle/manhole weights may be entered explicitly; reinforcement, PWHT, weld spacing and Annex P remain REVIEW."});
    return gates;
  }
  function generateCourses(shellHeight,targetHeight,materialKey,group,ca1,caOther){
    const H=n(shellHeight),target=Math.max(n(targetHeight,2.5),0.5);
    let rem=H,i=1,rows=[];
    while(rem>1e-8&&i<50){
      const h=rem>target?target:rem;
      const material=materialKey||DEFAULT_SHELL_MATERIAL;
      rows.push({course:i,height:+h.toFixed(4),material,group:resolveMaterialGroup(material,group||DEFAULT_SHELL_GROUP),ca:i===1?n(ca1):n(caOther),role:"liquid_shell",projectMinNominal:0,structuralNominal:0});
      rem-=h;i++;
    }
    return rows;
  }

  function designShell(input){
    const D=n(input.diameter),G=n(input.designSG),designLevel=n(input.designLevel),hydroLevel=n(input.hydroLevel),temp=n(input.designTemp),pi=n(input.internalPressure),step=n(input.plateStep,2),mdmt=n(input.mdmt);
    const class3=String(input.calculationMode||"governed")==="class3-screening";
    const designMethodValid=D>0&&D<=61&&temp<=260&&pi<=18&&G>0;
    const screeningProxyUsed=!designMethodValid&&class3&&D>61&&D<=SCREENING_MAX_DIAMETER_M&&temp<=260&&pi<=18&&G>0;
    const calculationAvailable=designMethodValid||screeningProxyUsed;
    const pressureHead=pi>=1?pi/(9.8*G):0;
    const codeMin=minShellThickness(D);
    const series=parsePlateSeries(input.plateSeries);
    let z=0,courses=[];

    for(const raw of input.courses||[]){
      const h=n(raw.height),role=raw.role||"liquid_shell";
      const material=raw.material||input.shellMaterial||DEFAULT_SHELL_MATERIAL;
      const group=resolveMaterialGroup(material,raw.group||input.shellGroup||DEFAULT_SHELL_GROUP);
      const allow=materialAllowables(material,temp);
      const hp=Math.max(designLevel-z,0),ht=Math.max(hydroLevel-z,0),hpEff=hp+pressureHead;
      let td=null,tt=null,required=null,apiSelected=null,codeSelectedFinal=null,recommended=null,governing="HOLD",prodStress=null,hydroStress=null;
      const projectMin=n(raw.projectMinNominal),structuralNominal=n(raw.structuralNominal);
      if(calculationAvailable&&allow){
        if(role==="liquid_shell"){
          td=4.9*D*Math.max(hpEff-0.3,0)*G/allow.sd+n(raw.ca);
          tt=4.9*D*Math.max(ht-0.3,0)/allow.st;
          required=Math.max(td,tt,codeMin);
          governing=required===codeMin?"Code minimum":td>=tt?"Product design":"Hydrotest";
        }else{
          required=codeMin;
          governing="Structural/top band minimum";
        }
        apiSelected=roundUp(required,step);
        codeSelectedFinal=Math.max(apiSelected,projectMin,structuralNominal);
        recommended=input.recommendedThicknessMode==="code-only"?codeSelectedFinal:nextSeriesThickness(codeSelectedFinal,series,step);
        const corroded=Math.max(recommended-n(raw.ca),0.001);
        prodStress=4.9*D*Math.max(hpEff-0.3,0)*G/corroded;
        hydroStress=4.9*D*Math.max(ht-0.3,0)/recommended;
        if(screeningProxyUsed) governing=`SCREENING PROXY · ${governing}`;
      }
      courses.push({course:raw.course,height:h,bottomElevation:z,role,material,group,ca:n(raw.ca),hp,hpEff,ht,allow,td,tt,codeMin,required,apiSelected,projectMin,structuralNominal,codeSelectedFinal,recommended,prodStress,hydroStress,governing,adjustments:[],screeningProxyUsed});
      z+=h;
    }

    if(calculationAvailable){
      for(let i=courses.length-2;i>=0;i--){
        const lower=courses[i],upper=courses[i+1];
        if(lower.recommended!=null&&upper.recommended!=null&&lower.recommended<upper.recommended){
          lower.recommended=upper.recommended;
          lower.codeSelectedFinal=Math.max(lower.codeSelectedFinal,upper.recommended);
          lower.adjustments.push("Raised to match course above.");
        }
        if(lower.allow&&upper.allow&&upper.allow.sd<lower.allow.sd&&lower.recommended!=null&&upper.required!=null&&lower.recommended<upper.required){
          lower.recommended=nextSeriesThickness(upper.required,series,step);
          lower.codeSelectedFinal=Math.max(lower.codeSelectedFinal,upper.required);
          lower.adjustments.push("Raised for lower/upper allowable-stress interaction.");
        }
        if(lower.recommended!=null&&lower.allow){
          const corroded=Math.max(lower.recommended-lower.ca,0.001);
          lower.prodStress=4.9*D*Math.max(lower.hpEff-0.3,0)*G/corroded;
          lower.hydroStress=4.9*D*Math.max(lower.ht-0.3,0)/lower.recommended;
        }
      }
    }

    for(const c of courses){
      if(c.recommended!=null&&c.group){
        const d=dmtNoImpactTemp(c.group,c.recommended);
        c.dmt={...d,pass:d.value==null?null:mdmt>=d.value};
      }else c.dmt={status:"REVIEW",value:null,pass:null,note:"Material group not confirmed or shell result unavailable."};
    }
    return {
      methodValid:designMethodValid,
      designMethodValid,
      screeningProxyUsed,
      calculationAvailable,
      status:designMethodValid?"OK":screeningProxyUsed?"SCREENING":"HOLD",
      methodLabel:designMethodValid?"API 650 SI 1-foot method":"Class 3 non-code shell weight proxy",
      pressureHead,codeMin,plateSeries:series,courses,totalCourseHeight:z,
      governance:screeningProxyUsed?"Thicknesses are an estimating proxy only. They are not an API 650 design release and must not be used for fabrication.":designMethodValid?"Within TankM governed shell-method scope.":"Shell calculation unavailable until a supported method or Class 3 screening mode is selected."
    };
  }
  function annularTableValue(firstThickness,stress){
    const t=n(firstThickness,NaN),s=n(stress,NaN);
    if(!Number.isFinite(t)||!Number.isFinite(s)||t<=0||t>45||s>250) return null;
    const col=s<=190?0:s<=210?1:s<=220?2:3;
    let row;
    if(t<=19) row=[6,6,7,9]; else if(t<=25) row=[6,7,10,11]; else if(t<=32) row=[6,9,12,14]; else if(t<=40) row=[8,11,14,17]; else row=[9,13,16,19];
    return row[col];
  }

  function designBottomAnnular(input,shell){
    const step=n(input.plateStep,2),bottomCA=n(input.bottomCA),annularCA=n(input.annularCA,bottomCA),D=n(input.diameter),H=n(input.designLevel),G=n(input.designSG),temp=n(input.designTemp);
    const class3=String(input.calculationMode||"governed")==="class3-screening";
    const autoClass3Annular=input.annularAutoClass3!==false;
    const ownerClass3Contingency=class3&&input.ownerClass3AnnularContingency===true;
    const bottomNominal=n(input.bottomPlateOverrideMm)>0?n(input.bottomPlateOverrideMm):roundUp(6+bottomCA,step);
    const first=shell.courses[0];
    let required=!!input.forceAnnular,reason=[];
    if(required) reason.push("Purchaser/project requirement.");
    if(class3&&autoClass3Annular&&D>61){required=true;reason.push("Class 3 large-tank automatic annular screening rule.");}
    if(ownerClass3Contingency){required=true;reason.push("Owner Class 3 annular contingency: 2.0× calculated width and 14 mm minimum thickness.");}
    if(temp>93&&D>30){required=true;reason.push("Hot-tank diameter screening trigger.");}
    const highGroups=["IV","IVA","V","VI","VIA"];
    if(first&&highGroups.includes(first.group)&&((first.prodStress||0)>160||(first.hydroStress||0)>171)){required=true;reason.push("Bottom-course material/stress screening trigger.");}
    if(n(input.annularThicknessOverrideMm)>0){required=true;reason.push("Explicit annular thickness entered.");}
    let productTable=null,hydroTable=null,nominal=null,widthMm=null;
    if(required&&first&&first.recommended!=null){
      productTable=annularTableValue(Math.max(first.recommended-first.ca,0),first.prodStress||0);
      hydroTable=annularTableValue(first.recommended,first.hydroStress||0);
      const tableReq=Math.max(productTable||0,hydroTable||0,6+annularCA);
      nominal=n(input.annularThicknessOverrideMm)>0?n(input.annularThicknessOverrideMm):(ownerClass3Contingency?Math.max(14,roundUp(tableReq,step)):roundUp(tableReq,step));
      const calcWidth=Math.max(600,215*Math.sqrt(Math.max(H*G,0)));
      widthMm=n(input.annularWidthOverrideMm)>0?n(input.annularWidthOverrideMm):(ownerClass3Contingency?calcWidth*2:(class3&&autoClass3Annular&&D>61?roundUp(calcWidth,100):calcWidth));
    }
    return {bottomNominal,required,determination:required?"REQUIRED":"NOT REQUIRED",reason,productTable,hydroTable,annularNominal:nominal,widthMm,outsideProjectionMm:50,ownerClass3Contingency};
  }

  function roofPlanArea(D){ return Math.PI*Math.pow(n(D)/2,2); }
  function fixedRoofArea(D,slopeDenom){
    const r=n(D)/2,N=Math.max(n(slopeDenom,16),0.001),rise=r/N,slant=Math.sqrt(r*r+rise*rise);
    return Math.PI*r*slant;
  }

  function designRoof(input){
    const D=n(input.diameter),rho=n(input.steelDensity,STEEL_DENSITY_DEFAULT),rt=input.roofType,roofCA=n(input.roofCA),step=n(input.plateStep,2);
    const class3=String(input.calculationMode||"governed")==="class3-screening";
    const planArea=roofPlanArea(D),coneArea=fixedRoofArea(D,input.roofSlope);
    const hasFixed=rt==="fixed"||rt==="ifr";
    const baseRoofPlate=n(input.roofPlateOverrideMm)>0?n(input.roofPlateOverrideMm):roundUp(5+roofCA,step);
    const plateMm=hasFixed?baseRoofPlate:0;
    const roofPlateMT=hasFixed?steelWeightMT(coneArea,plateMm,rho):0;
    const rsEntered=n(input.roofStructureKgM2);
    const roofStructureKgM2=hasFixed?(rsEntered>0?rsEntered:18):0;
    const roofStructureMT=hasFixed?coneArea*roofStructureKgM2/1000:0;
    let floatingKgM2=0,floatingBasisSource="N/A",screeningAssumptionUsed=false;
    const entered=n(input.floatingRoofKgM2);
    if(rt==="ifr"){
      floatingKgM2=entered>0?entered:38;
      floatingBasisSource=entered>0?"User-entered IFR dead load":"TankM IFR screening default";
      screeningAssumptionUsed=entered<=0;
    }
    if(rt==="efr"){
      if(entered>0){
        floatingKgM2=entered;
        floatingBasisSource="User-entered EFR dead load";
      }else if(input.floatingRoofSubtype==="double"&&class3){
        floatingKgM2=DOUBLE_DECK_EFR_SCREENING_KGM2;
        floatingBasisSource="TankM double-deck EFR Class 3 screening default from external As-Built evidence";
        screeningAssumptionUsed=true;
      }else if(input.floatingRoofSubtype==="single"){
        floatingKgM2=52;
        floatingBasisSource="TankM single-deck EFR screening default";
        screeningAssumptionUsed=true;
      }
    }
    const floatingRoofMT=planArea*floatingKgM2/1000;
    let status="REVIEW";
    if(rt==="efr"&&input.floatingRoofSubtype==="double"&&floatingKgM2<=0) status="HOLD";
    else if(rt==="efr"&&input.floatingRoofSubtype==="double"&&screeningAssumptionUsed) status="SCREENING";
    return {status,planAreaM2:planArea,coneAreaM2:coneArea,roofPlateMm:plateMm,roofPlateMT,roofStructureKgM2,roofStructureMT,floatingKgM2,floatingRoofMT,hasFixed,floatingBasisSource,screeningAssumptionUsed};
  }
  function designWind(input){
    const count=Math.max(0,Math.round(n(input.windGirderCount)));
    const kgPerM=Math.max(0,n(input.windGirderKgPerM));
    const perimeter=Math.PI*n(input.diameter);
    const mt=count*perimeter*kgPerM/1000;
    return {status:count>0||n(input.externalPressure)<=0.25?"REVIEW":"HOLD",girderCount:count,kgPerM,weightMT:mt,note:"TankM uses entered/verified wind-girder quantity for MTO. Detailed API 650 shell-buckling/H1 design remains a separate closure item."};
  }

  function designPressureAnchorage(input,mtoPre){
    const pi=n(input.internalPressure),anchored=String(input.anchorage||"Auto").toLowerCase()==="anchored";
    return {status:pi>0||anchored?"REVIEW":"OK",internalPressureKPa:pi,anchorage:input.anchorage||"Auto",note:"Annex F roof compression, uplift and anchor-bolt final design are not released in this screening build.",screeningDeadWeightMT:mtoPre||0};
  }

  function designSeismic(input){
    return {status:input.seismic?"REVIEW":"N/A",selected:!!input.seismic,note:input.seismic?"Site spectra, shell stress, freeboard, anchorage and foundation seismic closure require controlled project inputs.":"Seismic not selected."};
  }

  function designOpenings(input){
    const explicit=Math.max(0,n(input.openingsWeightMT));
    const nozzleCount=Math.max(0,Math.round(n(input.nozzleCount)));
    const manholeCount=Math.max(0,Math.round(n(input.manholeCount)));
    return {status:"REVIEW",nozzleCount,manholeCount,weightMT:explicit,note:"Entered weight contributes to MTO. Nozzle reinforcement, PWHT, weld-spacing and Annex P acceptance are not automated."};
  }

  function weightMTO(input,shell,bottom,roof,wind,openings){
    const D=n(input.diameter),rho=n(input.steelDensity,STEEL_DENSITY_DEFAULT),rows=[];
    let shellMT=0;
    for(const c of shell.courses){
      if(c.recommended==null) continue;
      const area=Math.PI*D*c.height,mt=steelWeightMT(area,c.recommended,rho);
      shellMT+=mt;rows.push({component:`Shell course ${c.course}`,basis:"pi x D x h",quantity:area,quantityUnit:"m2",thickness:`${c.recommended.toFixed(1)} mm`,weightMT:mt});
    }
    const plan=roofPlanArea(D);
    const bottomMT=steelWeightMT(plan,bottom.bottomNominal,rho);
    rows.push({component:"Bottom plates",basis:"Plan area",quantity:plan,quantityUnit:"m2",thickness:`${bottom.bottomNominal.toFixed(1)} mm`,weightMT:bottomMT});
    let annularMT=0;
    if(bottom.required&&bottom.annularNominal&&bottom.widthMm){
      const r=D/2,w=Math.min(bottom.widthMm/1000,r),ringArea=Math.PI*(r*r-Math.pow(Math.max(r-w,0),2));
      annularMT=steelWeightMT(ringArea,bottom.annularNominal,rho);
      rows.push({component:"Annular plates",basis:"Annular ring area; overlap not deducted from bottom screening plate",quantity:ringArea,quantityUnit:"m2",thickness:`${bottom.annularNominal.toFixed(1)} mm`,weightMT:annularMT});
    }
    if(roof.roofPlateMT>0) rows.push({component:"Fixed roof plate",basis:"Cone surface area",quantity:roof.coneAreaM2,quantityUnit:"m2",thickness:`${roof.roofPlateMm.toFixed(1)} mm`,weightMT:roof.roofPlateMT});
    if(roof.roofStructureMT>0) rows.push({component:"Fixed roof structure",basis:"Entered kg/m2 screening allowance",quantity:roof.coneAreaM2,quantityUnit:"m2",thickness:`${roof.roofStructureKgM2.toFixed(1)} kg/m2`,weightMT:roof.roofStructureMT});
    if(roof.floatingRoofMT>0) rows.push({component:input.roofType==="ifr"?"Internal floating roof":"External floating roof",basis:"Entered/selected dead-load basis",quantity:roof.planAreaM2,quantityUnit:"m2",thickness:`${roof.floatingKgM2.toFixed(1)} kg/m2`,weightMT:roof.floatingRoofMT});
    if(wind.weightMT>0) rows.push({component:"Wind girders",basis:"Count x perimeter x kg/m",quantity:wind.girderCount,quantityUnit:"no.",thickness:`${wind.kgPerM.toFixed(1)} kg/m`,weightMT:wind.weightMT});
    if(openings.weightMT>0) rows.push({component:"Nozzles/manholes/openings",basis:"Entered verified allowance",quantity:1,quantityUnit:"lot",thickness:"Explicit",weightMT:openings.weightMT});
    const preApp=shellMT+bottomMT+annularMT+roof.roofPlateMT+roof.roofStructureMT+roof.floatingRoofMT+wind.weightMT+openings.weightMT;
    const appPct=Math.max(0,n(input.appurtenancePct,8));
    const appMT=preApp*appPct/100;
    rows.push({component:"Other appurtenances allowance",basis:"% of explicit core steel",quantity:appPct,quantityUnit:"%",thickness:"Screening allowance",weightMT:appMT});
    const totalMT=preApp+appMT;
    return {rows,shellMT,bottomMT,annularMT,bottomAnnularMT:bottomMT+annularMT,roofPlateMT:roof.roofPlateMT,roofStructureMT:roof.roofStructureMT,floatingRoofMT:roof.floatingRoofMT,windGirderMT:wind.weightMT,openingsMT:openings.weightMT,appurtenanceMT:appMT,preAppurtenanceMT:preApp,totalMT};
  }

  function inferGeometryFromCapacity(input){
    const volume=n(input.storedCapacityM3)>0?n(input.storedCapacityM3):n(input.nominalCapacityM3);
    const level=n(input.designLevel)>0?n(input.designLevel):n(input.hydroLevel);
    const freeboard=Math.max(0.5,n(input.screeningFreeboardM,2));
    if(volume<=0||level<=0) return {available:false,diameterM:null,shellHeightM:null,volumeM3:volume,levelM:level,note:"Capacity and liquid level are required."};
    const diameter=Math.sqrt(4*volume/(Math.PI*level));
    const shellHeight=Math.max(level+freeboard,level*1.05);
    return {available:true,diameterM:diameter,shellHeightM:shellHeight,volumeM3:volume,levelM:level,freeboardM:freeboard,note:"Geometry inferred from cylindrical volume for Class 3 screening only."};
  }

  function estimateEligibility(input,shell,roof){
    const class3=String(input.calculationMode||"governed")==="class3-screening";
    const issues=[];
    if(!shell.calculationAvailable) issues.push("shell calculation unavailable");
    if(roof.status==="HOLD") issues.push("roof MTO basis unavailable");
    if(shell.screeningProxyUsed) issues.push("large-diameter shell uses non-code Class 3 proxy");
    if(roof.screeningAssumptionUsed) issues.push("roof dead load uses TankM screening default");
    const available=shell.calculationAvailable&&roof.status!=="HOLD";
    let status="HOLD";
    if(available) status=(shell.screeningProxyUsed||roof.status==="SCREENING"||class3)?"SCREENING":"PASS";
    return {available,status,issues,calculationMode:class3?"Class 3 Screening":"Governed Design"};
  }

  function completeWeight(input,mto,eligibility){
    if(eligibility&&eligibility.available===false) return {predictedEmptyWeightMT:null,globalPredictionMT:null,localAnchorWeight:0,localAnchorCorrectionMT:0,mode:"ESTIMATE_HOLD",domain:{status:"HOLD",issues:eligibility.issues||[]},governance:"Complete-weight prediction withheld because the screening estimate is not eligible."};
    if(global.TankMCalibration&&typeof global.TankMCalibration.predictCompleteWeight==="function") return global.TankMCalibration.predictCompleteWeight(input,mto.totalMT);
    return {predictedEmptyWeightMT:mto.totalMT,globalPredictionMT:null,localAnchorWeight:0,localAnchorCorrectionMT:0,mode:"CALIBRATION_UNAVAILABLE",domain:{status:"REVIEW",issues:["calibration.js not loaded"]},governance:"Raw core MTO used."};
  }
  function class3Range(base,lowPct=CLASS3_LOW_PCT,highPct=CLASS3_HIGH_PCT){
    const x=n(base),lo=n(lowPct,CLASS3_LOW_PCT),hi=n(highPct,CLASS3_HIGH_PCT);
    return {base:x,low:x*(1+lo/100),high:x*(1+hi/100),lowPct:lo,highPct:hi};
  }

  function estimateCost(input,mto,calibrated){
    const calibratedWeight=n(calibrated&&calibrated.predictedEmptyWeightMT,NaN);
    const coreWeight=n(mto&&mto.totalMT,0);
    const weightBasis=input.costWeightBasis==="core"?coreWeight:calibratedWeight;
    const qty=Math.max(1,Math.round(n(input.tankQuantity,1)));
    const year=Math.round(n(input.estimateYear,2026));
    const rawRate=n(input.rawSteelRateOverride)>0?n(input.rawSteelRateOverride):RAW_STEEL_RATES[year];
    if(!Number.isFinite(weightBasis)||weightBasis<=0){
      return {available:false,weightBasisMT:null,tankQuantity:qty,estimateYear:year,rawSteelRate:rawRate,rawSteelBasisINR:0,rawSteelBasisCr:0,materialSupplyCostINR:0,materialSupplyCostCr:0,serviceInstallationCostINR:0,serviceInstallationCostCr:0,baseCompleteCostINR:0,baseCompleteCostCr:0,selectedCompleteCostINR:0,selectedCompleteCostCr:0,weightRange:null,materialRange:null,serviceRange:null,completeRange:null,governance:"Cost withheld because a complete eligible weight estimate is unavailable."};
    }
    const materialFactor=n(input.materialIdiotIndexOverride)>0?n(input.materialIdiotIndexOverride):(n(input.idiotIndexOverride)>0?n(input.idiotIndexOverride):POOLED_IDIOT_INDEX);
    const requestedBaseCompleteFactor=n(input.completeIdiotIndexOverride)>0?n(input.completeIdiotIndexOverride):BASE_COMPLETE_IDIOT_INDEX;
    const baseCompleteFactor=Math.max(materialFactor,requestedBaseCompleteFactor);
    const requestedInstalledReferenceFactor=n(input.installedReferenceIdiotIndexOverride)>0?n(input.installedReferenceIdiotIndexOverride):INSTALLED_REFERENCE_IDIOT_INDEX;
    const installedReferenceFactor=Math.max(baseCompleteFactor,requestedInstalledReferenceFactor);
    const serviceFactor=baseCompleteFactor-materialFactor;
    const groundReferenceFactor=installedReferenceFactor-baseCompleteFactor;
    const rawSteelBasis=(rawRate&&weightBasis>0)?weightBasis*1000*rawRate:0;
    const materialSupplyCost=rawSteelBasis*materialFactor;
    const serviceInstallationCost=rawSteelBasis*serviceFactor;
    const baseCompleteCost=rawSteelBasis*baseCompleteFactor;
    const directGroundReferenceCost=rawSteelBasis*groundReferenceFactor;
    const installedReferenceCost=rawSteelBasis*installedReferenceFactor;
    const includeGroundReference=!!input.includeGroundReference;
    const selectedCompleteCost=includeGroundReference?installedReferenceCost:baseCompleteCost;

    const material=weightBasis*1000*n(input.materialRate);
    const fab=weightBasis*1000*n(input.fabRate);
    const engineering=(material+fab)*n(input.engineeringPct)/100;
    const civil=n(input.civilLakh)*100000;
    const ei=n(input.eiLakh)*100000;
    const other=n(input.otherLakh)*100000;
    const bottomUpSubtotal=material+fab+engineering+civil+ei+other;
    const contingency=bottomUpSubtotal*n(input.contingencyPct)/100;
    const escalation=(bottomUpSubtotal+contingency)*n(input.escalationPct)/100;
    const bottomUpTotal=bottomUpSubtotal+contingency+escalation;
    const designVol=roofPlanArea(input.diameter)*n(input.designLevel);

    const weightRange=class3Range(weightBasis,n(input.class3LowPct,CLASS3_LOW_PCT),n(input.class3HighPct,CLASS3_HIGH_PCT));
    const materialRange=class3Range(materialSupplyCost,weightRange.lowPct,weightRange.highPct);
    const serviceRange=class3Range(serviceInstallationCost,weightRange.lowPct,weightRange.highPct);
    const completeRange=class3Range(selectedCompleteCost,weightRange.lowPct,weightRange.highPct);

    return {
      available:true,
      weightBasisMT:weightBasis,tankQuantity:qty,estimateYear:year,rawSteelRate:rawRate,rawSteelBasisINR:rawSteelBasis,rawSteelBasisCr:rawSteelBasis/1e7,
      materialIdiotIndex:materialFactor,serviceInstallationIdiotIndex:serviceFactor,baseCompleteIdiotIndex:baseCompleteFactor,directGroundReferenceIdiotIndex:groundReferenceFactor,installedReferenceIdiotIndex:installedReferenceFactor,
      idiotIndex:materialFactor,
      materialSupplyCostINR:materialSupplyCost,materialSupplyCostCr:materialSupplyCost/1e7,
      serviceInstallationCostINR:serviceInstallationCost,serviceInstallationCostCr:serviceInstallationCost/1e7,
      baseCompleteCostINR:baseCompleteCost,baseCompleteCostCr:baseCompleteCost/1e7,
      directGroundReferenceCostINR:directGroundReferenceCost,directGroundReferenceCostCr:directGroundReferenceCost/1e7,
      installedReferenceCostINR:installedReferenceCost,installedReferenceCostCr:installedReferenceCost/1e7,
      includeGroundReference,selectedCompleteCostINR:selectedCompleteCost,selectedCompleteCostCr:selectedCompleteCost/1e7,
      supplyCostINR:materialSupplyCost,supplyCostCr:materialSupplyCost/1e7,
      screeningFinishedSupplyINRkg:rawRate?rawRate*materialFactor:null,
      screeningServiceINRkg:rawRate?rawRate*serviceFactor:null,
      screeningBaseCompleteINRkg:rawRate?rawRate*baseCompleteFactor:null,
      materialSharePct:selectedCompleteCost>0?100*materialSupplyCost/selectedCompleteCost:null,
      serviceSharePct:selectedCompleteCost>0?100*serviceInstallationCost/selectedCompleteCost:null,
      weightRange,materialRange,serviceRange,completeRange,
      quantityMaterialSupplyCostINR:materialSupplyCost*qty,quantityServiceInstallationCostINR:serviceInstallationCost*qty,quantitySelectedCompleteCostINR:selectedCompleteCost*qty,
      quantitySelectedCompleteCostCr:selectedCompleteCost*qty/1e7,
      material,fab,engineering,civil,ei,other,contingency,escalation,bottomUpTotal,bottomUpTotalCr:bottomUpTotal/1e7,
      designVolumeM3:designVol,supplyCostPerM3:designVol>0?materialSupplyCost/designVol:null,completeCostPerM3:designVol>0?selectedCompleteCost/designVol:null,
      governance:(COST_DATA&&COST_DATA.AUDIT)?COST_DATA.AUDIT.governance:"Owner commercial screening factors; not API 650 design rules."
    };
  }
  function validateEstimate(input,calibrated,cost){
    const actual=n(input.actualEmptyWeightMT);
    const predicted=n(calibrated&&calibrated.predictedEmptyWeightMT,NaN);
    if(actual<=0||!Number.isFinite(predicted)||predicted<=0) return {available:false,status:actual>0?"ESTIMATE HOLD":"NOT ENTERED",actualEmptyWeightMT:actual>0?actual:null,variancePct:null,differenceMT:null,withinClass3:null,actualInsideEstimateBand:null};
    const variance=100*(predicted-actual)/actual;
    const low=n(input.class3LowPct,CLASS3_LOW_PCT),high=n(input.class3HighPct,CLASS3_HIGH_PCT);
    const within=variance>=low&&variance<=high;
    const band=cost&&cost.weightRange?cost.weightRange:class3Range(predicted,low,high);
    const inside=actual>=band.low&&actual<=band.high;
    const isCalibrationAnchor=calibrated&&calibrated.localAnchorWeight>=0.999&&Math.abs(actual-predicted)<0.05;
    const status=isCalibrationAnchor?"CALIBRATION":within?"PASS":"REVIEW";
    return {available:true,status,actualEmptyWeightMT:actual,predictedEmptyWeightMT:predicted,differenceMT:predicted-actual,variancePct:variance,withinClass3:within,actualInsideEstimateBand:inside,isCalibrationAnchor,class3LowPct:low,class3HighPct:high,geometryBasis:input.geometryBasis||"Not stated",designCodeVintage:input.designCodeVintage||"Not stated"};
  }
  function overallStatus(gates,shell,roof,cal,eligibility){
    const engineeringStatus=(!shell.designMethodValid||gates.some(g=>g.severity==="HOLD")||roof.status==="HOLD")?"HOLD":gates.some(g=>g.severity==="REVIEW")?"REVIEW":"PASS";
    let estimateStatus="HOLD";
    if(eligibility&&eligibility.available){
      if(shell.screeningProxyUsed||roof.status==="SCREENING") estimateStatus="SCREENING";
      else if(cal&&cal.domain&&cal.domain.status!=="IN_DOMAIN") estimateStatus="REVIEW";
      else estimateStatus="PASS";
    }
    return {engineeringStatus,estimateStatus,headline:engineeringStatus==="PASS"&&estimateStatus==="PASS"?"PASS":estimateStatus==="SCREENING"?"SCREENING":engineeringStatus==="HOLD"?"HOLD":"REVIEW"};
  }
  function runDesign(input){
    const gates=scopeGates(input);
    const shell=designShell(input);
    const bottom=designBottomAnnular(input,shell);
    const roof=designRoof(input);
    const wind=designWind(input);
    const openings=designOpenings(input);
    const eligibility=estimateEligibility(input,shell,roof);
    const mto=weightMTO(input,shell,bottom,roof,wind,openings);
    const calibrated=completeWeight(input,mto,eligibility);
    const pressure=designPressureAnchorage(input,mto.totalMT);
    const seismic=designSeismic(input);
    const cost=estimateCost(input,mto,calibrated);
    const validation=validateEstimate(input,calibrated,cost);
    const overall=overallStatus(gates,shell,roof,calibrated,eligibility);
    const assumptions=[];
    if(shell.screeningProxyUsed) assumptions.push("Large-diameter shell weight uses a non-code 1-foot-equation proxy because D > 61 m.");
    if(roof.screeningAssumptionUsed) assumptions.push(`${roof.floatingBasisSource}: ${roof.floatingKgM2.toFixed(1)} kg/m².`);
    if(String(input.geometryBasis||"").toLowerCase().includes("inferred")) assumptions.push("Geometry is inferred, not a GA dimension.");
    if(String(input.geometryBasis||"").toLowerCase().includes("assumed")) assumptions.push("Geometry contains user/estimator assumptions for Class 3 screening.");
    return {version:VERSION,codeBasis:CODE_BASIS,input,gates,shell,bottom,roof,wind,pressure,seismic,openings,mto,eligibility,calibrated,cost,validation,overall,assumptions};
  }
  function calibrationDemoInput(){
    return {
      caseName:"IFR 20 m Calibration Check",storedLiquid:"Reformer Naphtha",calculationMode:"governed",nominalCapacityM3:0,storedCapacityM3:0,screeningFreeboardM:2,diameter:20,shellHeight:14.5,designLevel:11.72,hydroLevel:11.72,designSG:0.79,designTemp:65,mdmt:5,internalPressure:0,externalPressure:0,windSpeed:0,seismic:false,roofType:"ifr",floatingRoofSubtype:"single",anchorage:"Auto",
      shellMaterial:"NAT-250",shellGroup:"II",caBottomShell:1.5,caUpperShell:1.5,bottomCA:0,annularCA:0,roofCA:0.5,courseHeight:2.0,plateStep:2,recommendedThicknessMode:"validated-series",plateSeries:DEFAULT_PLATE_SERIES.slice(),steelDensity:7850,appurtenancePct:8,
      forceAnnular:true,bottomPlateOverrideMm:6,annularThicknessOverrideMm:8,annularWidthOverrideMm:1332,roofPlateOverrideMm:6,roofSlope:12,roofStructureKgM2:18,floatingRoofKgM2:38,windGirderCount:0,windGirderKgPerM:0,openingsWeightMT:0,nozzleCount:0,manholeCount:0,
      tankQuantity:1,estimateYear:2026,rawSteelRateOverride:0,idiotIndexOverride:0,materialIdiotIndexOverride:0,completeIdiotIndexOverride:0,installedReferenceIdiotIndexOverride:0,includeGroundReference:false,costWeightBasis:"calibrated",class3LowPct:-20,class3HighPct:30,actualEmptyWeightMT:142,geometryBasis:"Confirmed GA",designCodeVintage:"Unknown / not stated",materialRate:0,fabRate:0,engineeringPct:0,civilLakh:0,eiLakh:0,otherLakh:0,contingencyPct:0,escalationPct:0,
      courses:[
        {course:1,height:2.0,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0},
        {course:2,height:1.5,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0},
        {course:3,height:1.5,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0},
        {course:4,height:2.0,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0},
        {course:5,height:2.0,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0},
        {course:6,height:2.0,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0},
        {course:7,height:2.0,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0},
        {course:8,height:1.5,material:"NAT-250",group:"II",ca:1.5,role:"liquid_shell",projectMinNominal:0,structuralNominal:0}
      ]
    };
  }

  const api={VERSION,CODE_BASIS,materials,groups,DEFAULT_SHELL_MATERIAL,DEFAULT_SHELL_GROUP,materialGroupFor,resolveMaterialGroup,isMaterialGroupLocked,DEFAULT_PLATE_SERIES,RAW_STEEL_RATES,POOLED_IDIOT_INDEX,BASE_COMPLETE_IDIOT_INDEX,INSTALLED_REFERENCE_IDIOT_INDEX,CLASS3_LOW_PCT,CLASS3_HIGH_PCT,SCREENING_MAX_DIAMETER_M,DOUBLE_DECK_EFR_SCREENING_KGM2,n,roundUp,parsePlateSeries,nextSeriesThickness,minShellThickness,tempReductionFactor,materialAllowables,dmtNoImpactTemp,scopeGates,generateCourses,designShell,annularTableValue,designBottomAnnular,roofPlanArea,fixedRoofArea,designRoof,designWind,designPressureAnchorage,designSeismic,designOpenings,weightMTO,inferGeometryFromCapacity,estimateEligibility,completeWeight,class3Range,estimateCost,validateEstimate,runDesign,calibrationDemoInput,steelWeightMT,pct};
  global.TankEngine=api;
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
