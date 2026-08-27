(function(global){
  "use strict";

  // Owner-side historical commercial normalization from the scope-governed audit:
  // Tank_Idiot_Index_PO_Yearwise_Conversion_Audit_Complete_Cost_v2_Scope_Governed.xlsx
  // Keep this module separate from API 650 engineering logic.
  const COST_DATA_VERSION = "2026-08-27-scope-governed-lstk";

  const RAW_STEEL_RATES = {
    2021:{low:55.00,recommended:64.75,high:70.00,status:"Observed PO year"},
    2022:{low:54.00,recommended:70.90,high:80.00,status:"Observed PO year"},
    2023:{low:47.00,recommended:57.40,high:63.00,status:"Screening conversion only"},
    2024:{low:47.00,recommended:52.20,high:55.00,status:"Screening conversion only"},
    2025:{low:44.00,recommended:55.05,high:61.00,status:"Screening conversion only"},
    2026:{low:50.00,recommended:56.50,high:60.00,status:"Screening conversion only"}
  };

  const FACTORS = {
    // Pooled PO Supply Billing Index across 24 tanks / 2021-2022 NREP LSTK POs.
    // This is a procurement/supply billing benchmark. It is NOT a pure tank-steel
    // or fabrication-only multiplier.
    supplyBilling: 2.1469839411750753,

    // Pooled Base LSTK Installed Tank Package Index.
    // Numerator = PO Supply + Engineering + Construction billing components.
    // Contract scope includes tank foundation/civil and multidisciplinary installed works.
    baseLSTK: 4.7710754248417135,

    // Pooled Reference LSTK Index. This adds the directly attributable DHT ground-
    // improvement amount that was explicitly excluded from the DHT base family item.
    referenceLSTK: 4.802926688446918
  };

  // Derived audit layers. The non-supply layer is simply the contractual billing
  // remainder between Base LSTK and PO Supply Billing. Do not describe it as erection-only.
  FACTORS.nonSupplyLSTKBilling = FACTORS.baseLSTK - FACTORS.supplyBilling;
  FACTORS.directGroundReference = FACTORS.referenceLSTK - FACTORS.baseLSTK;

  // Backward-compatible aliases for older TankM builds / saved JSON.
  // New code should use supplyBilling, baseLSTK and referenceLSTK.
  FACTORS.materialSupply = FACTORS.supplyBilling;
  FACTORS.baseComplete = FACTORS.baseLSTK;
  FACTORS.installedReference = FACTORS.referenceLSTK;
  FACTORS.serviceInstallation = FACTORS.nonSupplyLSTKBilling;

  const AUDIT = {
    sourceWorkbook: "Tank_Idiot_Index_PO_Yearwise_Conversion_Audit_Complete_Cost_v2_Scope_Governed.xlsx",
    calibrationPopulation: "24 tanks across NREP Phase-I (2021) and Phase-II (2022)",
    poScopeClass: "Complete LSTK Installed Tank Package",
    foundationCivilIncluded: true,
    supplyBillingDefinition: "PO supply/procurement billing component normalized by empty weight x PO-year raw CS rate; not pure fabrication cost",
    nonSupplyDefinition: "Base LSTK less PO Supply Billing; contractual Engineering + Construction billing remainder, including broad installed scope",
    baseLSTKDefinition: "PO Supply + Engineering + Construction billing components normalized by empty weight x PO-year raw CS rate",
    referenceLSTKDefinition: "Base LSTK plus directly attributable scope explicitly excluded from a base family item; currently DHT ground improvement",
    scopeIncludes: [
      "Tank foundation and civil works",
      "Soil improvement where required by the LSTK contract",
      "Civil and structural works",
      "Tank erection / mechanical works",
      "Associated piping",
      "Electrical and instrumentation",
      "Fire protection",
      "Cathodic protection",
      "Testing, hydrotesting and calibration",
      "Painting / insulation where applicable",
      "Mechanical completion / handover obligations"
    ],
    exclusions: [
      "GST",
      "Package-wide historic steel/structural/rebar price variations",
      "Unallocated package-wide change orders",
      "Non-comparable project-wide scope"
    ],
    applicationRules: [
      "Do not call the 2.147 factor a tank fabrication factor.",
      "Do not call the 4.771 factor a tank-steel cost factor.",
      "Use Base LSTK only for scope-comparable complete installed-package screening.",
      "Use Reference LSTK only when comparable directly attributable ground improvement is intentionally included.",
      "Weight-based LSTK factors are empirical Class 3 screening relationships, not substitutes for explicit discipline build-up when project scope is known."
    ],
    governance: "Commercial Class 3 screening factors only. Historical NREP factors represent broad LSTK package billing scope, including foundation/civil and multidisciplinary works. They do not alter API 650 design thickness or MTO engineering logic."
  };

  const api={COST_DATA_VERSION,RAW_STEEL_RATES,FACTORS,AUDIT};
  global.TankMCostData=api;
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
})(typeof window!=="undefined"?window:globalThis);

