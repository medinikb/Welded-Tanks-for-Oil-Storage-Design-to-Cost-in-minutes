# TankM Owner Cost Intelligence Basis

This release separates owner-facing tank cost into three auditable layers using the supplied Tank Idiot Index workbook.

## Evidence-based pooled factors

| Cost layer | Factor | Definition |
|---|---:|---|
| Material Supply Index | 2.1469839412 | Vendor/fabrication supply only |
| Non-Supply LSTK Billing Index | 2.6240914837 | Derived as Base LSTK minus PO Supply Billing |
| Base LSTK Index | 4.7710754248 | Complete historical LSTK billing basis, including foundation/civil and multidisciplinary installed scope |
| Direct Ground Reference Increment | 0.0318512636 | Derived as Reference LSTK minus Base LSTK |
| Reference LSTK Index | 4.8029266884 | Base LSTK + directly attributable comparable tank-specific ground improvement |

The service/installation factor is not an independently fitted index. It is the audited remainder:

`Non-Supply LSTK Billing Index = Base LSTK Index - PO Supply Billing Index`

This preserves reconciliation:

`PO Supply Billing + Non-Supply LSTK Billing = Base LSTK Cost`

## Screening formulas

Let:

- `W` = selected TankM weight basis, kg
- `R` = estimate-year recommended raw CS rate, INR/kg
- `I_mat` = 2.1469839412
- `I_base` = 4.7710754248
- `I_inst` = 4.8029266884

Then:

`Raw steel basis = W x R`

`PO supply billing = W x R x I_supply`

`Non-supply LSTK billing = W x R x (I_base - I_supply)`

`Base LSTK cost = W x R x I_base`

`Reference installed cost = W x R x I_inst`

## Recommended raw carbon-steel rates embedded

| Year | INR/kg |
|---|---:|
| 2021 | 64.75 |
| 2022 | 70.90 |
| 2023 | 57.40 |
| 2024 | 52.20 |
| 2025 | 55.05 |
| 2026 | 56.50 |

2021 and 2022 are observed PO years in the supplied audit. 2023 to 2026 are screening conversion years using the pooled factors.

## Owner interpretation

- **Material Cost** supports procurement and supply benchmarking.
- **Non-Supply LSTK Billing** shows the historical billing remainder after PO supply; it is not a discipline-by-discipline service estimate.
- **Base LSTK Cost** is the preferred Class 3 package screening total when comparable ground improvement is not selected.
- **Installed / Reference Cost** is optional and should be used only when directly attributable comparable ground improvement is intentionally included.

Do not add historic package-wide price-variation lines on top of a current-year raw steel rate. That would risk double counting escalation.
