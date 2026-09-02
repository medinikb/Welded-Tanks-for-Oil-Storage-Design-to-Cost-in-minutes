# GitHub Upload

Recommended: keep the owner-calibrated build in a private repository until commercial factors and calibration data are cleared for release.

## New repository or clean replacement

```bash
git init
git add .
git commit -m "TankM Class 3 small-tank completion rule"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

## Existing repository

```bash
git checkout -b tankm-small-tank-class3
# Copy/replace this release files
node tests.js
git add .
git commit -m "Add governed small-tank Class 3 completion rule"
git push -u origin tankm-small-tank-class3
```

For GitHub Pages, keep `index.html` at repository root and enable Pages from the desired branch after internal review. The approved FEED template is intentionally included; `node_modules`, private files, Excel workbooks other than that template, PDFs, and local environment files are excluded by `.gitignore`.
