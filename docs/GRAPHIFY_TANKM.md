# Graphify for TankM

This repository uses Graphify as a code-navigation and impact-analysis layer for Codex. Graphify helps identify relationships between files, functions, concepts, and governance documents. It is not the engineering source of truth.

## One-time setup on Windows

From the repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-graphify.ps1
```

If `uv` is not installed:

```powershell
winget install astral-sh.uv
```

Then reopen PowerShell and rerun the setup script.

The setup performs four actions:

1. Installs or upgrades the official `graphifyy` package.
2. Installs Graphify project-scoped for Codex.
3. Builds a directed knowledge graph for TankM.
4. Runs `node tests.js` when Node.js is available.

## Generated outputs

Graphify creates:

```text
graphify-out/
├── graph.html
├── graph.json
└── GRAPH_REPORT.md
```

`graph.html` is the interactive visualization. `graph.json` is the persistent graph used for graph queries. `GRAPH_REPORT.md` summarizes major concepts, communities, and relationships.

## Recommended TankM queries

### Architecture

```powershell
graphify query "What are the major subsystems in TankM?"
graphify explain "runDesign"
graphify path "collectInput" "runDesign"
```

### Engineering flow

```powershell
graphify query "Trace tank diameter and design level through shell thickness calculation"
graphify query "Where is ASTM A537M Class 1 defined and how is API material group VI enforced?"
graphify query "Which functions control the D greater than 61 m HOLD and Class 3 screening behavior?"
```

### Weight flow

```powershell
graphify query "Trace the flow from FEED input to core MTO to predicted complete empty weight"
graphify path "weightMTO" "completeWeight"
```

### Cost flow

```powershell
graphify query "Trace raw steel rate and Idiot Index factors to selected LSTK cost"
graphify path "completeWeight" "estimateCost"
```

### Change impact

Before changing a major rule, ask questions such as:

```powershell
graphify query "What depends on DEFAULT_SHELL_MATERIAL?"
graphify query "What would be affected if completeWeight calibration logic changes?"
graphify query "Which UI and batch functions consume runDesign results?"
```

## Update after code changes

```powershell
graphify . --update --directed
node tests.js
```

Use the graph to identify impact, but confirm any engineering conclusion against `CODE_BASIS.md`, `engine.js`, and the regression tests.

## Recommended operating rule

For TankM, use a graph-first but source-verified workflow:

```text
Question or proposed change
        ↓
Graphify query / path / explain
        ↓
Identify affected functions and files
        ↓
Read authoritative source and governance basis
        ↓
Make the smallest coherent change
        ↓
Run tests
        ↓
Refresh graph
```

Do not use an `INFERRED` or `AMBIGUOUS` graph relationship as an engineering requirement without source verification.
