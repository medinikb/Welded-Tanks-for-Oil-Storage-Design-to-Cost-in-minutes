(function(global){
  "use strict";

  // Owner-side historical commercial normalization from:
  // Tank_Idiot_Index_PO_Yearwise_Conversion_Audit_Complete_Cost.xlsx
  // Keep this module separate from API 650 engineering logic.
  const COST_DATA_VERSION = "2026-08-25-owner-audit";

  const RAW_STEEL_RATES = {
    2021:{low:55.00,recommended:64.75,high:70.00,status:"Observed PO year"},
    2022:{low:54.00,recommended:70.90,high:80.00,status:"Observed PO year"},
    2023:{low:47.00,recommended:57.40,high:63.00,status:"Projected using pooled factor"},
    2024:{low:47.00,recommended:52.20,high:55.00,status:"Projected using pooled factor"},
    2025:{low:44.00,recommended:55.05,high:61.00,status:"Projected using pooled factor"},
    2026:{low:50.00,recommended:56.50,high:60.00,status:"Projected using pooled factor"}
  };

  const FACTORS = {
    // Supply-only pooled factor across 24 tanks / 2021-2022 POs.
    materialSupply: 2.1469839411750753,

    // Pooled complete base factor: Supply + Engineering + Construction.
    baseComplete: 4.7710754248417135,

    // Pooled reference factor including only directly attributable comparable
    // tank-specific ground improvement in the audit dataset.
    installedReference: 4.802926688446918
  };

  // Owner-facing cost split. Service/installation is deliberately derived as
  // the remainder of the audited Base Complete factor after material supply.
  FACTORS.serviceInstallation = FACTORS.baseComplete - FACTORS.materialSupply;
  FACTORS.directGroundReference = FACTORS.installedReference - FACTORS.baseComplete;

  const AUDIT = {
    sourceWorkbook: "Tank_Idiot_Index_PO_Yearwise_Conversion_Audit_Complete_Cost.xlsx",
    calibrationPopulation: "24 tanks across Phase-I (2021) and Phase-II (2022)",
    materialDefinition: "Supply-only component normalized by empty weight x PO-year raw CS rate",
    baseCompleteDefinition: "Supply + Engineering + Construction normalized by empty weight x PO-year raw CS rate",
    installedReferenceDefinition: "Base Complete plus only directly attributable comparable tank-specific ground improvement",
    exclusions: [
      "GST",
      "Package-wide historic steel/structural/rebar price variations",
      "Unallocated package-wide change orders",
      "Non-comparable project-wide scope"
    ],
    governance: "Commercial screening factors only. They do not alter API 650 design thickness or MTO engineering logic."
  };

  const api={COST_DATA_VERSION,RAW_STEEL_RATES,FACTORS,AUDIT};
  global.TankMCostData=api;
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
