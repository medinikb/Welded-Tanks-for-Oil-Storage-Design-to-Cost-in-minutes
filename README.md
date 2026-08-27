# Welded-Tanks-for-Oil-Storage: Design-to-Cost-in-minutes

Estimate the weight and Class 3 owner cost of up to 99 tanks in minutes, not weeks.

Live link: https://medinikb.github.io/Welded-Tanks-for-Oil-Storage-Design-to-Cost-in-minutes/

## Commercial model governance

TankM keeps API 650 engineering logic separate from historical commercial calibration.

The current cost model is normalized from 24 NREP tanks across two Lumpsum Turnkey storage-tank packages placed in 2021 and 2022. The historical contracts include broad installed-package scope, including tank foundation/civil and multidisciplinary works. Therefore the factors must be interpreted as PO billing benchmarks, not pure discipline unit rates.

| Factor | Value | Correct interpretation |
| --- | ---: | --- |
| PO Supply Billing Idiot Index | 2.146984 | Historical PO supply/procurement billing component normalized by empty weight and PO-year raw carbon-steel rate. It is not a pure tank-fabrication factor. |
| Base LSTK Idiot Index | 4.771075 | Historical Supply + Engineering + Construction billing total for the complete installed LSTK tank package. Historical contract scope includes foundation/civil and multidisciplinary installed works. |
| Reference LSTK Idiot Index | 4.802927 | Base LSTK plus the normalized directly attributable DHT ground-improvement amount that was explicitly excluded from the DHT base family item. |

### Application rules

1. Do not call 2.146984 a fabrication factor.
2. Do not call 4.771075 a tank-steel cost factor.
3. The difference between Base LSTK and PO Supply Billing is a non-supply LSTK billing remainder. It includes Engineering + Construction billing and must not be described as erection labour only.
4. Use Base LSTK only when the estimate scope is comparable to the historical complete installed tank package.
5. Use Reference LSTK only when comparable directly attributable ground improvement is intentionally included.
6. When project scope is sufficiently defined, explicit bottom-up foundation/civil/E&I/fire/CP estimates should be used as an independent cross-check rather than blindly relying on the historical weight-based factor.

The historical cost factors are Class 3 commercial screening relationships. They do not modify API 650 shell thickness, plate selection, MTO, or other engineering design calculations.

