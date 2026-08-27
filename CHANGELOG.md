# Changelog

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
