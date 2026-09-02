# TankM Code and Governance Basis

## Engineering code basis

The current TankM engineering library remains based on API 650 12th Edition with Addendum 3 (2018) for the implemented rule set. Original project code vintage is stored as metadata and does not automatically apply a weight correction factor.

## Shell design method

TankM's governed SI 1-foot shell method is limited to D <= 61 m.

### Governed Design mode

If D > 61 m:

- Engineering shell status = HOLD
- Recommended shell thickness is not issued as code-compliant design
- Complete calibrated weight and cost are withheld
- VDP or elastic shell analysis is required for detailed design

### Class 3 Screening mode

For 61 m < D <= 80 m, this release may calculate a **non-code shell weight proxy** using the same 1-foot-equation structure solely for owner-side Class 3 MTO screening.

The output must show:

- Engineering Status = HOLD
- Class 3 Estimate Status = SCREENING
- Shell method label = Class 3 non-code shell weight proxy
- Assumption register statement that the thicknesses are not fabrication-design values

The screening proxy must never be described as API 650 compliance.

## Temperature

TankM's current elevated-temperature implementation applies the embedded Annex M screening reduction above 93 C within the implemented range up to 260 C.

## Pressure and vacuum

Detailed Annex F roof/uplift and Annex V external-pressure design are not fabrication-release capable in this build. The tool preserves REVIEW/HOLD status where applicable.

## Floating roofs

- IFR default screening basis: 38 kg/m2 when no verified basis is entered.
- Single-deck EFR default screening basis: 52 kg/m2 when no verified basis is entered.
- Double-deck EFR:
  - Governed Design: verified dead-load basis required.
  - Class 3 Screening: 115.8 kg/m2 external As-Built screening anchor may be used if no basis is entered.

## Completion model

The completion layer estimates complete empty weight from the API 650 Core MTO. It does not alter engineering plate thickness.

### Small-tank Class 3 rule

For a **small tank**, defined as **Core MTO < 100 MT OR diameter < 19 m**, TankM uses:

`Predicted Complete Empty Weight = 1.50 × Core MTO`

This deterministic owner-side Class 3 rule is based on six external small-tank actual-weight checks. On that validation set the 1.50 factor produced approximately **9.83% MAPE**, with observed errors from **-8.16% to +25.02%**, and all six checks inside the default -20% / +30% Class 3 target.

The global ridge/local-anchor completion model is retained as a diagnostic only for small tanks and does **not** set the final small-tank weight.

### Medium and large tanks

The existing TankM empirical completion model remains unchanged for tanks that do not meet the small-tank rule. Out-of-domain medium/large cases remain visibly marked REVIEW/SCREENING when applicable.

## Class 3 target

Default owner target is -20% / +30% versus actual complete empty weight or cost, where actual data is available.

## Cost segregation

The owner commercial layer is independent of API 650 engineering logic:

- Material Supply Index: 2.1469839411750753
- Non-Supply LSTK Billing Index: 2.6240914836666382
- Base LSTK Index: 4.7710754248417135
- Installed / Reference Index: 4.802926688446918

PO Supply Billing + Non-Supply LSTK Billing reconciles exactly to Base LSTK. The governed Base LSTK basis includes foundation/civil and multidisciplinary installed scope represented by the historical billing data.
