# TankM Agent Guidance

## Purpose

Use the repository graph as a navigation and impact-analysis aid when it exists. The graph does not override engineering source code, tests, or governance documents.

## Graph-first workflow

When `graphify-out/graph.json` exists and the task is about code architecture, dependencies, data flow, impact analysis, or locating implementation logic:

1. Query Graphify first.
2. Use the returned subgraph to identify the smallest relevant source files and functions.
3. Read the authoritative source code before changing behavior.
4. Run regression tests after any engineering or commercial logic change.

Useful commands:

```powershell
graphify query "Where is shell material selection implemented?"
graphify query "Trace the flow from FEED inputs to complete empty weight"
graphify path "runDesign" "estimateCost"
graphify explain "runDesign"
graphify . --update --directed
```

If the graph is missing or stale, rebuild/update it before relying on graph relationships.

## Engineering authority order

For TankM, use this authority order:

1. `CODE_BASIS.md` for declared engineering scope, limitations, and governance.
2. `engine.js` for implemented engineering and estimation logic.
3. `tests.js` for regression invariants that must remain true unless intentionally revised.
4. `cost-data.js`, `IDIOT_INDEX_BASIS.md`, and related calibration files for commercial calibration and historical-cost governance.
5. `app.js` and `batch.js` for UI/batch orchestration and data mapping.
6. Graphify output for navigation, relationship discovery, and impact analysis only.

Never treat an inferred graph edge as an engineering requirement.

## Critical TankM boundaries

- API 650 engineering logic and commercial calibration are separate layers.
- Historical Idiot Index factors are commercial screening relationships, not shell-design or fabrication factors.
- `runDesign()` in `engine.js` is the main design orchestration path.
- ASTM A537M Class 1 is currently the default shell material and maps to API material group VI.
- For diameter above 61 m, governed shell design remains HOLD. Class 3 screening may use disclosed non-code proxies only within the implemented range.
- Do not weaken HOLD/REVIEW/SCREENING governance simply to produce a numerical answer.

## Change discipline

Before modifying engineering logic:

1. Identify affected functions with Graphify.
2. Confirm the current rule in `CODE_BASIS.md` and `engine.js`.
3. Identify all affected tests in `tests.js`.
4. Make the smallest coherent change.
5. Run:

```powershell
node tests.js
```

6. Update `CODE_BASIS.md`, `README.md`, or calibration documentation when the governing basis changes.
7. Refresh the graph:

```powershell
graphify . --update --directed
```

## Preferred impact-analysis questions

Before significant changes, answer:

- What user-facing result changes?
- Which engineering assumptions or code limits are affected?
- Which functions and files depend on this behavior?
- Which regression tests protect the current behavior?
- Does the change affect only engineering, only commercial calibration, or both?
- Does it alter any HOLD/REVIEW/SCREENING decision?
