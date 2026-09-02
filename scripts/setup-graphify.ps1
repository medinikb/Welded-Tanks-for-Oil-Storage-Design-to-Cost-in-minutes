$ErrorActionPreference = "Stop"

Write-Host "TankM Graphify setup" -ForegroundColor Cyan

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv is not installed. Install it first with: winget install astral-sh.uv"
}

Write-Host "1/4 Installing or upgrading Graphify..."
uv tool install --upgrade graphifyy

if (-not (Get-Command graphify -ErrorAction SilentlyContinue)) {
    Write-Host "Refreshing PATH for uv tools..."
    uv tool update-shell
    throw "Graphify was installed, but this terminal cannot see it yet. Open a new PowerShell window and run this script again."
}

Write-Host "2/4 Installing the Graphify skill for Codex in this repository..."
graphify install --project --platform codex

Write-Host "3/4 Building a directed TankM knowledge graph..."
graphify . --directed

Write-Host "4/4 Running TankM regression tests..."
if (Get-Command node -ErrorAction SilentlyContinue) {
    node tests.js
} else {
    Write-Warning "Node.js was not found, so tests.js was not executed. Install Node.js and run: node tests.js"
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Open: graphify-out/graph.html"
Write-Host "Try:  graphify query `"Trace the flow from FEED inputs to complete empty weight`""
Write-Host "Try:  graphify path `"runDesign`" `"estimateCost`""
Write-Host "After code changes: graphify . --update --directed"
