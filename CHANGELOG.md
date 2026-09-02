# Changelog

## Small-tank Class 3 completion rule

### Changed
- Small tank definition: **Core MTO < 100 MT OR diameter < 19 m**.
- Small-tank predicted complete empty weight is **1.50 × Core MTO**.
- The global ridge output remains an audit diagnostic for small tanks and does not drive their final complete weight.
- Medium and large TankM completion logic is unchanged.
- Validation basis: six external actual-weight checks, approximately 9.83% MAPE, all six within -20% / +30% Class 3 bounds.

## Current release Dual-Mode Class 3

### Added
- Separate **Governed Design** and **Class 3 Screening** modes.
- Engineering status and Class 3 estimate status shown independently.
- D > 61 m preserves Engineering HOLD while Class 3 mode can continue with explicit non-code shell weight proxy.
- Hard screening cap at 80 m diameter.
- Capacity/liquid-level geometry inference helper with visible geometry-basis tag.
- Class 3 double-deck EFR default of 115.8 kg/m2 when no verified basis is entered.
- Assumption register in engineering report.
- Complete browser controller `app.js` and responsive `styles.css` included in release package.
- Node regression test suite.

### Preserved
- IFR 20 m calibration anchor remains 142.000 MT.
- Historical cost split retained for traceability and superseded in the live UI by governed PO Supply Billing, Non-Supply LSTK Billing, and Base LSTK labels.
- Class 3 -20% / +30% default target.

### Governance change
- Numerical screening output outside the 61 m shell-design gate is never presented as code-compliant shell design.
