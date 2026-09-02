"use strict";
require("./cost-data.js");
const C=require("./calibration.js");
const E=require("./engine.js");
function ok(cond,msg){ if(!cond) throw new Error(msg); console.log("PASS",msg); }
function near(a,b,tol,msg){ ok(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b}`); }

const anchor=E.runDesign(E.calibrationDemoInput());
near(anchor.mto.totalMT,106.40921983673917,0.001,"Calibration anchor core MTO unchanged");
near(anchor.calibrated.predictedEmptyWeightMT,142,0.001,"Calibration anchor complete weight unchanged");

// Small tanks use a governed completion factor; Core MTO itself is unchanged.
const smallFW=C.predictCompleteWeight({diameter:17.5,designTemp:65,roofType:"open",floatingRoofSubtype:""},61.9);
near(smallFW.predictedEmptyWeightMT,92.85,1e-9,"Small tank uses 1.50 x Core MTO");
ok(smallFW.mode==="SMALL_TANK_CORE_FACTOR","Small tank reports deterministic completion mode");
ok(smallFW.domain.status==="SMALL_TANK_RULE","Small tank reports governed small-tank domain");
near(smallFW.smallTankFactor,1.5,1e-12,"Small tank completion factor is 1.50");

const mediumCF=C.predictCompleteWeight({diameter:27,designTemp:65,roofType:"efr",floatingRoofSubtype:"single"},138.3);
near(mediumCF.predictedEmptyWeightMT,234.92156015138823,1e-9,"Medium tank existing TankM prediction unchanged");
ok(mediumCF.mode==="GLOBAL_RIDGE","Medium tank keeps existing global ridge model");
const mediumVD=C.predictCompleteWeight({diameter:34,designTemp:100,roofType:"fixed",floatingRoofSubtype:""},217.9);
near(mediumVD.predictedEmptyWeightMT,391.01948990967145,1e-9,"Medium hot fixed-roof TankM prediction unchanged");

function largeCase(mode){
  const D=65.6,H=19.75;
  return {
    caseName:"60,000 m3 crude screening regression",calculationMode:mode,storedLiquid:"Crude oil",tankQuantity:10,geometryBasis:"Inferred from capacity",designCodeVintage:"API 650 13th Ed.",actualEmptyWeightMT:1550,
    nominalCapacityM3:60000,storedCapacityM3:60000,screeningFreeboardM:2,diameter:D,shellHeight:H,designLevel:17.75,hydroLevel:17.75,designSG:.888,designTemp:65,mdmt:11.3,internalPressure:0,externalPressure:0,windSpeed:234,seismic:true,roofType:"efr",floatingRoofSubtype:"double",anchorage:"Auto",
    shellMaterial:"A537M-C1",shellGroup:"VI",caBottomShell:3,caUpperShell:1.5,bottomCA:3,annularCA:3,roofCA:1,courseHeight:2.5,plateStep:2,recommendedThicknessMode:"validated-series",plateSeries:"6,8,10,12,14,16,18,20,22,24,28,32,36,40,45,50",steelDensity:7850,appurtenancePct:8,
    forceAnnular:true,bottomPlateOverrideMm:0,annularThicknessOverrideMm:14,annularWidthOverrideMm:900,roofSlope:16,roofPlateOverrideMm:0,roofStructureKgM2:0,floatingRoofKgM2:0,windGirderCount:0,windGirderKgPerM:0,openingsWeightMT:0,nozzleCount:0,manholeCount:0,
    estimateYear:2026,rawSteelRateOverride:0,materialIdiotIndexOverride:0,completeIdiotIndexOverride:0,installedReferenceIdiotIndexOverride:0,includeGroundReference:false,costWeightBasis:"calibrated",class3LowPct:-20,class3HighPct:30,materialRate:0,fabRate:0,engineeringPct:0,civilLakh:0,eiLakh:0,otherLakh:0,contingencyPct:0,escalationPct:0,
    courses:E.generateCourses(H,2.5,"A537M-C1","VI",3,1.5)
  };
}

// Default-material governance: ASTM A537M Class 1 is the TankM shell default,
// and its API material group is derived rather than independently selectable.
ok(E.DEFAULT_SHELL_MATERIAL==="A537M-C1","Default shell material is ASTM A537M Class 1");
ok(E.DEFAULT_SHELL_GROUP==="VI","Default API material group is VI");
ok(E.materialGroupFor("A537M-C1")==="VI","A537M Class 1 maps to API material group VI");
ok(E.resolveMaterialGroup("A537M-C1","II")==="VI","A537M Class 1 overrides an incompatible manually supplied group");
const defaultCourses=E.generateCourses(10,2.5,undefined,undefined,3,1.5);
ok(defaultCourses.every(c=>c.material==="A537M-C1"&&c.group==="VI"),"Generated courses inherit A537M Class 1 / Group VI defaults");
const mismatched=largeCase("class3-screening");
mismatched.courses=mismatched.courses.map(c=>({...c,group:"II"}));
const normalized=E.runDesign(mismatched);
ok(normalized.shell.courses.every(c=>c.group==="VI"),"Engine normalizes A537M Class 1 course group to VI");

const governed=E.runDesign(largeCase("governed"));
ok(governed.shell.status==="HOLD","Governed mode HOLDS shell design above 61 m");
ok(governed.overall.engineeringStatus==="HOLD","Governed engineering status is HOLD above 61 m");
ok(governed.overall.estimateStatus==="HOLD","Governed estimate is withheld above 61 m without proxy");
ok(governed.calibrated.predictedEmptyWeightMT==null,"Governed mode does not issue complete weight above 61 m");

const screening=E.runDesign(largeCase("class3-screening"));
ok(screening.shell.screeningProxyUsed===true,"Class 3 mode explicitly activates large-diameter shell proxy");
ok(screening.overall.engineeringStatus==="HOLD","Class 3 mode preserves engineering HOLD");
ok(screening.overall.estimateStatus==="SCREENING","Class 3 mode issues SCREENING estimate status");
near(screening.roof.floatingKgM2,115.8,1e-9,"Double-deck EFR Class 3 default");
ok(screening.calibrated.predictedEmptyWeightMT>0,"Class 3 mode produces complete screening weight");
ok(screening.validation.withinClass3===true,"60,000 m3 regression example falls inside Class 3 validation band");

const automaticAnnularInput=largeCase("class3-screening");
automaticAnnularInput.forceAnnular=false;automaticAnnularInput.annularAutoClass3=true;automaticAnnularInput.annularThicknessOverrideMm=0;automaticAnnularInput.annularWidthOverrideMm=0;
const automaticAnnular=E.runDesign(automaticAnnularInput);
ok(automaticAnnular.bottom.required===true,"Class 3 large-tank automation requires annular plate");
near(automaticAnnular.bottom.widthMm,900,1e-9,"Class 3 automatic annular width rounds up to 100 mm module");

const ownerContingencyInput=largeCase("class3-screening");
ownerContingencyInput.forceAnnular=false;ownerContingencyInput.ownerClass3AnnularContingency=true;ownerContingencyInput.annularThicknessOverrideMm=0;ownerContingencyInput.annularWidthOverrideMm=0;
const ownerContingency=E.runDesign(ownerContingencyInput);
ok(ownerContingency.bottom.ownerClass3Contingency===true,"Owner Class 3 annular contingency is disclosed");
near(ownerContingency.bottom.annularNominal,14,1e-9,"Owner Class 3 annular contingency applies 14 mm minimum");
near(ownerContingency.bottom.widthMm,2*Math.max(600,215*Math.sqrt(17.75*.888)),1e-9,"Owner Class 3 annular contingency doubles calculated width");

const f=TankMCostData.FACTORS;
near(f.materialSupply+f.serviceInstallation,f.baseComplete,1e-12,"Material + service factors reconcile to base complete");
near(f.baseComplete+f.directGroundReference,f.installedReference,1e-12,"Ground reference factor reconciles");
near(f.supplyBilling+f.nonSupplyLSTKBilling,f.baseLSTK,1e-12,"Supply billing + non-supply LSTK reconcile to Base LSTK");
near(f.baseLSTK+f.directGroundReference,f.referenceLSTK,1e-12,"Base LSTK + ground reference reconcile to Reference LSTK");
ok(TankMCostData.AUDIT.foundationCivilIncluded===true,"Governed Base LSTK discloses foundation and civil scope");
ok(screening.cost.selectedLSTKCostCr===screening.cost.selectedCompleteCostCr,"Legacy selected-complete cost alias remains compatible");

const inferred=E.inferGeometryFromCapacity({storedCapacityM3:60000,designLevel:17.75,screeningFreeboardM:2});
ok(inferred.available,"Capacity geometry inference available");
near(inferred.diameterM,65.596,0.02,"Capacity-based diameter inference");

console.log("ALL TESTS PASSED");
