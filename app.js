(function(){
  "use strict";
  const E=window.TankEngine;
  if(!E){ document.body.innerHTML='<p style="padding:20px">TankM engine failed to load.</p>'; return; }
  const $=id=>document.getElementById(id);
  const num=id=>Number($(id)?.value||0);
  const val=id=>$(id)?.value??"";
  const checked=id=>!!$(id)?.checked;
  // Screen values are limited to two decimals; calculations retain their full precision.
  const fmt=(x,d=2)=>{ const places=Math.min(Math.max(0,Number(d)||0),2); return Number.isFinite(Number(x))?Number(x).toLocaleString(undefined,{minimumFractionDigits:places,maximumFractionDigits:places}):"-"; };
  const fmtMT=x=>Number.isFinite(Number(x))?`${fmt(x,2)} MT`:"HOLD";
  const fmtCr=x=>Number.isFinite(Number(x))?`₹${fmt(x,2)} Cr`:"HOLD";
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let lastResult=null;
  let scenarioSlots=null;
  let activeScenario="base";

  function markCaseDirty(){
    const status=$("caseControlStatus");
    if(!status) return;
    status.textContent="Inputs changed — update required.";
    status.classList.add("dirty");
    const button=$("runBtn"); if(button) button.textContent="Update Estimate";
  }
  function markEstimateUpdated(){
    const status=$("caseControlStatus");
    if(!status) return;
    status.textContent=`Estimate updated at ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}.`;
    status.classList.remove("dirty");
    const button=$("runBtn"); if(button) button.textContent="Update Estimate";
  }

  function syncMaterialGroup(materialSelect,groupSelect){
    if(!materialSelect||!groupSelect) return;
    const derived=E.materialGroupFor?.(materialSelect.value)||"";
    if(derived) groupSelect.value=derived;
    groupSelect.disabled=!!(derived&&E.isMaterialGroupLocked?.(materialSelect.value));
    groupSelect.title=groupSelect.disabled?`Auto-derived from ${E.materials[materialSelect.value]?.label||materialSelect.value}`:"Select API material group";
  }

  function populateSelects(){
    const ms=$("shellMaterial");
    ms.innerHTML=Object.entries(E.materials).map(([k,v])=>`<option value="${esc(k)}">${esc(v.label)}</option>`).join("");
    ms.value=E.DEFAULT_SHELL_MATERIAL||"A537M-C1";
    const gs=$("shellGroup");
    gs.innerHTML=E.groups.filter(Boolean).map(g=>`<option>${esc(g)}</option>`).join("");
    gs.value=E.DEFAULT_SHELL_GROUP||"VI";
    syncMaterialGroup(ms,gs);
  }

  function courseRow(c){
    const matOpts=Object.entries(E.materials).map(([k,v])=>`<option value="${k}" ${k===c.material?"selected":""}>${esc(v.label)}</option>`).join("");
    const resolvedGroup=E.resolveMaterialGroup?.(c.material,c.group)||c.group;
    const groupOpts=E.groups.filter(Boolean).map(g=>`<option ${g===resolvedGroup?"selected":""}>${g}</option>`).join("");
    return `<tr data-course="${c.course}">
      <td>${c.course}</td><td><input class="c-height" type="number" step="0.1" value="${c.height}"></td>
      <td><select class="c-material">${matOpts}</select></td><td><select class="c-group">${groupOpts}</select></td>
      <td><input class="c-ca" type="number" step="0.5" value="${c.ca}"></td>
      <td><select class="c-role"><option value="liquid_shell" ${c.role==="liquid_shell"?"selected":""}>Liquid shell</option><option value="structural" ${c.role!=="liquid_shell"?"selected":""}>Structural/top band</option></select></td>
      <td><input class="c-project" type="number" step="0.5" value="${c.projectMinNominal||0}"></td>
      <td><input class="c-struct" type="number" step="0.5" value="${c.structuralNominal||0}"></td></tr>`;
  }

  function bindCourseMaterialGroups(){
    $("courseInputTable").querySelectorAll("tbody tr").forEach(tr=>{
      const material=tr.querySelector(".c-material"),group=tr.querySelector(".c-group");
      const sync=()=>syncMaterialGroup(material,group);
      material?.addEventListener("change",sync);sync();
    });
  }
  function setCourses(courses){$("courseInputTable").querySelector("tbody").innerHTML=(courses||[]).map(courseRow).join("");bindCourseMaterialGroups();}
  function generateCourses(){
    const rows=E.generateCourses(num("shellHeight"),num("courseHeight"),val("shellMaterial"),val("shellGroup"),num("caBottomShell"),num("caUpperShell"));
    setCourses(rows);
  }
  function readCourses(){
    return [...$("courseInputTable").querySelectorAll("tbody tr")].map((tr,i)=>({
      course:i+1,height:Number(tr.querySelector(".c-height").value||0),material:tr.querySelector(".c-material").value,group:E.resolveMaterialGroup?.(tr.querySelector(".c-material").value,tr.querySelector(".c-group").value)||tr.querySelector(".c-group").value,ca:Number(tr.querySelector(".c-ca").value||0),role:tr.querySelector(".c-role").value,projectMinNominal:Number(tr.querySelector(".c-project").value||0),structuralNominal:Number(tr.querySelector(".c-struct").value||0)
    })).filter(c=>c.height>0);
  }

  const scalarIds=["caseName","calculationMode","storedLiquid","tankQuantity","geometryBasis","designCodeVintage","actualEmptyWeightMT","nominalCapacityM3","storedCapacityM3","screeningFreeboardM","diameter","shellHeight","designLevel","hydroLevel","designSG","designTemp","mdmt","internalPressure","externalPressure","windSpeed","roofType","floatingRoofSubtype","anchorage","shellMaterial","shellGroup","caBottomShell","caUpperShell","bottomCA","annularCA","roofCA","courseHeight","plateStep","plateSeries","recommendedThicknessMode","steelDensity","appurtenancePct","bottomPlateOverrideMm","annularThicknessOverrideMm","annularWidthOverrideMm","roofSlope","roofPlateOverrideMm","roofStructureKgM2","windGirderCount","windGirderKgPerM","floatingRoofKgM2","nozzleCount","manholeCount","openingsWeightMT","estimateYear","rawSteelRateOverride","supplyBillingIdiotIndexOverride","baseLSTKIdiotIndexOverride","referenceLSTKIdiotIndexOverride","costWeightBasis","class3LowPct","class3HighPct","materialRate","fabRate","engineeringPct","civilLakh","eiLakh","otherLakh","contingencyPct","escalationPct"];
  const checkIds=["seismic","forceAnnular","annularAutoClass3","ownerClass3AnnularContingency","includeGroundReference"];

  function collectInput(){
    const o={};
    for(const id of scalarIds){
      const el=$(id); if(!el) continue;
      o[id]=(el.type==="number"?Number(el.value||0):el.value);
    }
    for(const id of checkIds) o[id]=checked(id);
    o.courses=readCourses();
    return o;
  }

  function loadInput(o){
    if(!o) return;
    // Schema migration for TankM case files saved before the scope-governance refactor.
    const x={...o};
    if(x.supplyBillingIdiotIndexOverride==null&&x.materialIdiotIndexOverride!=null) x.supplyBillingIdiotIndexOverride=x.materialIdiotIndexOverride;
    if(x.baseLSTKIdiotIndexOverride==null&&x.completeIdiotIndexOverride!=null) x.baseLSTKIdiotIndexOverride=x.completeIdiotIndexOverride;
    if(x.referenceLSTKIdiotIndexOverride==null&&x.installedReferenceIdiotIndexOverride!=null) x.referenceLSTKIdiotIndexOverride=x.installedReferenceIdiotIndexOverride;
    for(const id of scalarIds){ const el=$(id); if(el&&x[id]!=null) el.value=x[id]; }
    for(const id of checkIds){ const el=$(id); if(el&&x[id]!=null) el.checked=!!x[id]; }
    syncMaterialGroup($("shellMaterial"),$("shellGroup"));
    if(x.courses?.length) setCourses(x.courses); else generateCourses();
  }

  function statusClass(s){ s=String(s||"REVIEW").toLowerCase(); return s==="pass"||s==="ok"?"pass":s==="hold"?"hold":s==="screening"?"screening":"review"; }
  function setStatus(){
    if(!lastResult) return;
    const o=lastResult.overall;
    $("overallStatus").textContent=o.headline;
    $("overallStatus").className=`status ${statusClass(o.headline)}`;
    $("engineeringStatus").textContent=o.engineeringStatus;
    $("estimateStatus").textContent=o.estimateStatus;
    $("overallStatusText").textContent=o.engineeringStatus==="HOLD"&&o.estimateStatus==="SCREENING"?"Engineering design is HOLD; Class 3 estimate continues with disclosed proxies.":`Engineering ${o.engineeringStatus}; estimate ${o.estimateStatus}.`;
  }

  function defs(id,items){ $(id).innerHTML=items.map(([a,b])=>`<div><dt>${esc(a)}</dt><dd>${b}</dd></div>`).join(""); }
  function notes(id,items){ $(id).innerHTML=items.filter(Boolean).map(x=>`<div class="note ${x.cls||""}">${x.html||esc(x.text||x)}</div>`).join(""); }
  function eqNum(x,d=2){ return x==null||!Number.isFinite(Number(x))?"–":fmt(x,d); }
  function equationTable(headings,rows){ return `<div class="equation-table-wrap"><table class="equation-table"><thead><tr>${headings.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`; }
  const frac=(top,bottom)=>`<span class="fraction"><span>${top}</span><span>${bottom}</span></span>`;
  const worked=(title,body)=>`<div class="worked-example"><strong>Worked example · ${title}</strong><div>${body}</div></div>`;

  function renderGeometryEquationFlow(r){
    const i=r.input||{},g=E.inferGeometryFromCapacity(i),V=Number(g.volumeM3||0),H=Number(g.levelM||0),inferred=String(i.geometryBasis||"").toLowerCase().includes("inferred")&&g.available;
    const result=inferred?`D = √${frac(`4 × ${eqNum(V,2)}`,`π × ${eqNum(H,2)}`)} = <b>${eqNum(g.diameterM,2)} m</b>. H<sub>shell</sub> = max (${eqNum(H,2)} + ${eqNum(g.freeboardM,2)}, 1.05 × ${eqNum(H,2)}) = <b>${eqNum(g.shellHeightM,2)} m</b>.`:`Geometry is currently based on <b>${esc(i.geometryBasis||"entered dimensions")}</b>. Inference is shown only after capacity and liquid level are entered and “Inferred from capacity” is selected.`;
    $("geometryEquationFlow").innerHTML=`<h2><span class="equation-number">A</span>Geometry inference when dimensions are unavailable</h2><div class="equation-layout"><div class="formula-card"><span class="formula-label">Formula</span><div class="formula-display">D = √${frac("4 × V","π × H")}</div><div class="formula-display">H<sub>shell</sub> = max (H + FB, 1.05H)</div><small>Use inferred geometry only for Class 3 screening; replace it with approved GAD dimensions when available.</small></div><div class="formula-legend"><span><strong>V</strong> stored / nominal capacity in m³.</span><span><strong>H</strong> design liquid level in m; <strong>FB</strong> screening freeboard in m.</span><span><strong>D</strong> inferred tank diameter in m; <strong>H<sub>shell</sub></strong> inferred shell height in m.</span><span>Actual GAD diameter and shell height always take priority over inferred dimensions.</span></div></div>${worked("Current case",result)} `;
  }

  function renderShellEquationFlow(r){
    const s=r.shell,c=s.courses[0]||{},i=r.input||{};
    const rows=s.courses.map(c=>`<tr><td>${c.course}</td><td>${eqNum(c.hp)} m</td><td>${eqNum(c.td)} mm</td><td>${eqNum(c.tt)} mm</td><td>${eqNum(c.recommended)} mm</td><td>${esc(c.governing)}</td></tr>`);
    $("shellEquationFlow").innerHTML=`<h2><span class="equation-number">B</span>Shell thickness calculation flow</h2><div class="equation-layout"><div class="formula-card"><span class="formula-label">Formula</span><div class="formula-display">t<sub>d</sub> = ${frac("4.9 × D × (H<sub>p</sub> − 0.3) × SG","S<sub>d</sub>")} + CA</div><div class="formula-display">t<sub>t</sub> = ${frac("4.9 × D × (H<sub>t</sub> − 0.3)","S<sub>t</sub>")}</div><small>Selected plate = higher applicable thickness, rounded to plate step and project minimum.</small></div><div class="formula-legend"><span><strong>D</strong> tank diameter; <strong>H<sub>p</sub></strong> product head; <strong>H<sub>t</sub></strong> hydrotest head.</span><span><strong>SG</strong> design specific gravity; <strong>S<sub>d</sub>, S<sub>t</sub></strong> allowable stresses; <strong>CA</strong> corrosion allowance.</span><span><strong>t<sub>d</sub></strong> design thickness and <strong>t<sub>t</sub></strong> hydrotest thickness are shown below for every course.</span></div></div>${worked("Course 1 — current case",`t<sub>d</sub> = ${frac(`4.9 × ${eqNum(i.diameter,2)} × (${eqNum(c.hp,2)} − 0.3) × ${eqNum(i.designSG,3)}`,"S<sub>d</sub>")} + ${eqNum(c.ca,2)} = <b>${eqNum(c.td,2)} mm</b>. Selected nominal plate = <b>${eqNum(c.recommended,2)} mm</b>.`)}${s.screeningProxyUsed?`<div class="equation-warning">Class 3 screening proxy: this is an estimate-only thickness basis, not a fabrication release.</div>`:""}${equationTable(["Course","Product head","Design tᵈ","Hydrotest tᵗ","Selected nominal","Governing"],rows)}`;
  }

  function renderBottomEquationFlow(r){
    const b=r.bottom, first=r.shell.courses[0]||{};
    const annularReq=Math.max(Number(b.productTable)||0,Number(b.hydroTable)||0,6+Number(r.input?.annularCAmm||0));
    const annular=b.annularNominal?`<tr><td>Annular plate</td><td>${eqNum(annularReq)} mm</td><td>${eqNum(b.annularNominal)} mm</td><td>${eqNum(b.widthMm)} mm</td><td>${b.ownerClass3Contingency?"Owner Class 3 override active":"API / project basis"}</td></tr>`:"<tr><td colspan=5>Annular plate is not triggered by the current design basis.</td></tr>";
    const calcWidth=Math.max(600,215*Math.sqrt(Math.max(Number(r.input?.designLevel||0)*Number(r.input?.designSG||0),0)));
    $("bottomEquationFlow").innerHTML=`<h2><span class="equation-number">C</span>Bottom & annular calculation flow</h2><div class="equation-layout"><div class="formula-card"><span class="formula-label">Formula</span><div class="formula-display">t<sub>bottom</sub> = round-up (6 + CA)</div><div class="formula-display">W<sub>calc</sub> = max [600, 215 × √(H × SG)]</div><small>Owner Class 3 option: W<sub>final</sub> = 2 × W<sub>calc</sub>; annular nominal is not less than 14 mm.</small></div><div class="formula-legend"><span><strong>H</strong> is design liquid height and <strong>SG</strong> is the higher applicable specific gravity (operating fluid or water).</span><span>Annular table requirement is evaluated from the first shell course before owner contingency is applied.</span><span>Owner contingency is an estimating instruction only; it does not replace API 650 detailed design.</span></div></div>${worked("Current case",`W<sub>calc</sub> = max [600, 215 × √(${eqNum(r.input?.designLevel,2)} × ${eqNum(r.input?.designSG,3)})] = <b>${eqNum(calcWidth,2)} mm</b>${b.ownerClass3Contingency?`; owner contingency: W<sub>final</sub> = 2 × ${eqNum(calcWidth,2)} = <b>${eqNum(b.widthMm,2)} mm</b>.`:"."}`)}${equationTable(["Item","Table / calculated requirement","Selected nominal","Final width","Basis"],[`<tr><td>Bottom plate</td><td>6 + CA = ${eqNum(b.bottomNominal)} mm selected</td><td>${eqNum(b.bottomNominal)} mm</td><td>–</td><td>Bottom corrosion allowance</td></tr>`,annular])}`;
  }

  function renderMtoEquationFlow(r){
    const m=r.mto;
    const example=m.rows.find(x=>/shell/i.test(x.component))||m.rows[0]||{};
    $("mtoEquationFlow").innerHTML=`<h2><span class="equation-number">D</span>Weight build-up flow</h2><div class="equation-layout"><div class="formula-card"><span class="formula-label">Formula</span><div class="formula-display">Weight (MT) = ${frac("Area × t × ρ","1,000,000")}</div><div class="formula-display">A<sub>shell</sub> = πDh &nbsp; | &nbsp; A<sub>bottom</sub> = ${frac("πD²","4")}</div><small>Core MTO = pre-appurtenance weight + appurtenance allowance.</small></div><div class="formula-legend"><span><strong>Area</strong> is plate area in m², <strong>t</strong> is nominal thickness in mm, and <strong>ρ</strong> is steel density in kg/m³.</span><span>Appurtenance allowance covers estimating items not fully itemised in the plate take-off.</span><span>The table below shows the exact live component weights contributing to the Core MTO.</span></div></div>${worked(`${esc(example.component||"first MTO item")}`,`${esc(example.basis||"Calculated component")} = <b>${fmtMT(example.weightMT)}</b>. This component contributes to Core MTO = <b>${fmtMT(m.totalMT)}</b>.`)}${equationTable(["Component","Calculated weight"],m.rows.map(x=>`<tr><td>${esc(x.component)}</td><td>${fmtMT(x.weightMT)}</td></tr>`).concat([`<tr class="equation-total"><td>Core MTO total</td><td>${fmtMT(m.totalMT)}</td></tr>`]))}`;
  }

  function renderCostEquationFlow(r){
    const c=r.cost;
    if(!c?.available){
      $("costEquationFlow").innerHTML=`<h2><span class="equation-number">E</span>Cost calculation flow</h2><div class="equation-warning">Cost remains HOLD until an eligible weight estimate is available.</div>`;
      return;
    }
    const selectedLabel=c.includeGroundReference?"Reference LSTK":"Base LSTK";
    const selectedFactor=c.includeGroundReference?c.referenceLSTKIdiotIndex:c.baseLSTKIdiotIndex;
    $("costEquationFlow").innerHTML=`<h2><span class="equation-number">E</span>Cost calculation flow</h2>
      <div class="equation-layout">
        <div class="formula-card">
          <span class="formula-label">Formula</span>
          <div class="formula-display">C<sub>raw</sub> = W × 1,000 × R</div>
          <div class="formula-display">C<sub>LSTK</sub> = C<sub>raw</sub> × I<sub>LSTK</sub></div>
          <small>The historical factors are PO billing normalizations. They are not pure fabrication or erection rates.</small>
        </div>
        <div class="formula-legend">
          <span><strong>W</strong> is eligible TankM weight in MT; 1,000 converts MT to kg; <strong>R</strong> is the raw-steel normalization rate.</span>
          <span><strong>I<sub>LSTK</sub></strong> is the selected Base or Reference LSTK package index.</span>
          <span>Base LSTK includes foundation/civil and multidisciplinary installed scope in the historical NREP contracts.</span>
        </div>
      </div>
      ${worked("Current case",`C<sub>raw</sub> = ${eqNum(c.weightBasisMT,2)} × 1,000 × ₹${eqNum(c.rawSteelRate,2)} = <b>${fmtCr(c.rawSteelBasisCr)}</b>; ${selectedLabel} = ${fmtCr(c.rawSteelBasisCr)} × ${eqNum(selectedFactor,4)} = <b>${fmtCr(c.selectedLSTKCostCr)}</b>.`)}
      ${equationTable(["Step","Live calculation"],[
        `<tr><td>Raw steel normalization basis</td><td>${fmtMT(c.weightBasisMT)} × 1,000 × ₹${eqNum(c.rawSteelRate,2)}/kg = ${fmtCr(c.rawSteelBasisCr)}</td></tr>`,
        `<tr><td>PO Supply Billing benchmark</td><td>${fmtCr(c.rawSteelBasisCr)} × ${eqNum(c.supplyBillingIdiotIndex,4)} = ${fmtCr(c.supplyBillingCostCr)}</td></tr>`,
        `<tr><td>Non-supply LSTK billing remainder</td><td>${fmtCr(c.rawSteelBasisCr)} × (${eqNum(c.baseLSTKIdiotIndex,4)} − ${eqNum(c.supplyBillingIdiotIndex,4)}) = ${fmtCr(c.nonSupplyLSTKBillingCostCr)}</td></tr>`,
        `<tr class="equation-total"><td>${selectedLabel} installed package</td><td>${fmtCr(c.selectedLSTKCostCr)}</td></tr>`
      ])}`;
  }

  function renderShell(r){
    $("shellMethod").textContent=r.shell.methodLabel;
    $("pressureHead").textContent=`${fmt(r.shell.pressureHead,2)} m`;
    $("shellCodeMin").textContent=`${fmt(r.shell.codeMin,2)} mm`;
    $("shellResultTable").querySelector("tbody").innerHTML=r.shell.courses.map(c=>`<tr>
      <td>${c.course}</td><td>${fmt(c.bottomElevation,2)}</td><td>${fmt(c.hp,2)}</td><td>${fmt(c.td,2)}</td><td>${fmt(c.tt,2)}</td><td>${fmt(c.codeMin,2)}</td><td>${fmt(c.apiSelected,2)}</td><td>${fmt(c.projectMin,2)}</td><td><strong>${fmt(c.recommended,2)}</strong></td><td>${esc(c.governing)}</td><td>${c.dmt?.value==null?"REVIEW":`${fmt(c.dmt.value,2)}°C ${c.dmt.pass?"PASS":"REVIEW"}`}</td></tr>`).join("");
    const arr=[{html:`<strong>${esc(r.shell.status)}</strong>: ${esc(r.shell.governance)}`,cls:r.shell.screeningProxyUsed?"screening-note":""}];
    r.shell.courses.flatMap(c=>c.adjustments||[]).forEach(a=>arr.push({text:a}));
    notes("shellNotes",arr);
    renderShellEquationFlow(r);
  }

  function renderBottom(r){
    defs("bottomDetails",[["Bottom nominal",`${fmt(r.bottom.bottomNominal,2)} mm`],["Annular determination",esc(r.bottom.determination)],["Annular nominal",r.bottom.annularNominal?`${fmt(r.bottom.annularNominal,2)} mm`:"-"],["Annular width",r.bottom.widthMm?`${fmt(r.bottom.widthMm,2)} mm`:"-"],["Owner Class 3 contingency",r.bottom.ownerClass3Contingency?"ACTIVE · 2.0× width / 14 mm minimum":"Not active"],["Basis",esc((r.bottom.reason||[]).join(" ")||"No annular trigger in current screening logic")]]);
    renderBottomEquationFlow(r);
  }
  function renderRoof(r){
    defs("roofDetails",[["Plan area",`${fmt(r.roof.planAreaM2,2)} m²`],["Cone area",`${fmt(r.roof.coneAreaM2,2)} m²`],["Roof plate",fmtMT(r.roof.roofPlateMT)],["Roof structure",fmtMT(r.roof.roofStructureMT)],["Floating roof",fmtMT(r.roof.floatingRoofMT)],["Floating basis",`${fmt(r.roof.floatingKgM2,2)} kg/m²`],["Basis source",esc(r.roof.floatingBasisSource||"N/A")],["Roof status",`<span class="pill ${statusClass(r.roof.status)}">${esc(r.roof.status)}</span>`]]);
    defs("floatingDetails",[["Dead-load basis",`${fmt(r.roof.floatingKgM2,2)} kg/m²`],["Floating roof weight",fmtMT(r.roof.floatingRoofMT)],["Basis source",esc(r.roof.floatingBasisSource||"N/A")],["Status",esc(r.roof.status)]]);
  }
  function renderWind(r){ defs("windDetails",[["Count",r.wind.girderCount],["Unit mass",`${fmt(r.wind.kgPerM,2)} kg/m`],["Weight",fmtMT(r.wind.weightMT)],["Status",esc(r.wind.status)],["Note",esc(r.wind.note)]]); }
  function renderPressure(r){ defs("pressureDetails",[["Internal pressure",`${fmt(r.pressure.internalPressureKPa,2)} kPa(g)`],["Anchorage",esc(r.pressure.anchorage)],["Status",esc(r.pressure.status)],["Note",esc(r.pressure.note)]]); }
  function renderSeismic(r){ defs("seismicDetails",[["Selected",r.seismic.selected?"Yes":"No"],["Status",esc(r.seismic.status)],["Note",esc(r.seismic.note)]]); }
  function renderOpenings(r){ defs("openingsDetails",[["Nozzles",r.openings.nozzleCount],["Manholes",r.openings.manholeCount],["Entered weight",fmtMT(r.openings.weightMT)],["Status",esc(r.openings.status)],["Note",esc(r.openings.note)]]); }

  function renderCalibrationAudit(r){
    const box=$("calibrationAuditBody"),cal=window.TankMCalibration,model=cal?.GLOBAL_MODEL;
    if(!box)return;
    if(!model||!Number.isFinite(r.calibrated?.predictedEmptyWeightMT)){box.innerHTML='<p class="muted">Calibration audit is unavailable for this result.</p>';return;}
    if(r.calibrated.mode==="SMALL_TANK_CORE_FACTOR"){
      const rule=cal?.SMALL_TANK_RULE||{},core=r.mto.totalMT,predicted=r.calibrated.predictedEmptyWeightMT,factor=r.calibrated.smallTankFactor||rule.factor||1.5,uplift=predicted-core,upliftPct=core?uplift/core*100:0,v=rule.validation||{};
      const warningList=(r.calibrated.domain?.issues||[]).map(issue=>`<li>${esc(issue)}</li>`).join("")||"<li>No additional small-tank rule warning.</li>";
      box.innerHTML=`<div class="audit-callout"><strong>Small-tank deterministic Class 3 completion rule.</strong><span>Existing medium/large TankM completion logic is bypassed only for the small-tank domain.</span></div><div class="audit-equations"><div><span>Core MTO</span><strong>${fmt(core,2)} MT</strong></div><div><span>Small-tank factor</span><strong>${fmt(factor,2)} × Core MTO</strong></div><div><span>Complete prediction</span><strong>${fmt(core,2)} × ${fmt(factor,2)} = ${fmt(predicted,2)} MT</strong></div><div><span>Completion uplift</span><strong>${fmt(predicted,2)} − ${fmt(core,2)} = ${fmt(uplift,2)} MT (${fmt(upliftPct,2)}%)</strong></div><div><span>Global ridge diagnostic only</span><strong>${fmt(r.calibrated.globalPredictionMT,2)} MT (not used in final small-tank weight)</strong></div></div><div class="audit-bottom"><div><h3>Small-tank validation</h3><dl><dt>External checks</dt><dd>${v.n??"-"}</dd><dt>MAPE</dt><dd>${fmt(v.mapePct,2)}%</dd><dt>Observed error range</dt><dd>${fmt(v.minErrorPct,2)}% to +${fmt(v.maxErrorPct,2)}%</dd><dt>Class 3 passes</dt><dd>${v.class3PassCount??"-"}/${v.n??"-"}</dd></dl></div><div><h3>Rule & governance</h3><ul>${warningList}</ul><p>${esc(rule.governance||r.calibrated.governance||"")}</p></div></div>`;
      return;
    }
    const x=cal.featureVector(r.input,r.mto.totalMT),units=["MT","m²","0 / 1","0 / 1","0 / 1"];
    const rows=model.featureNames.map((name,i)=>{const z=(x[i]-model.means[i])/model.sds[i],contribution=model.beta[i+1]*z;return {name,value:x[i],unit:units[i],mean:model.means[i],sd:model.sds[i],z,coefficient:model.beta[i+1],contribution};});
    const reconstructed=model.beta[0]+rows.reduce((sum,row)=>sum+row.contribution,0),local=r.calibrated.localAnchorCorrectionMT||0,predicted=r.calibrated.predictedEmptyWeightMT,core=r.mto.totalMT,uplift=predicted-core,upliftPct=core?uplift/core*100:0,v=model.validation||{};
    const warningList=(r.calibrated.domain?.issues||[]).map(issue=>`<li>${esc(issue)}</li>`).join("")||"<li>No additional calibration-domain warning.</li>";
    box.innerHTML=`<div class="audit-callout"><strong>Empirical owner-estimating model—not an API 650 equation.</strong><span>Dataset: ${model.n} historical tank families · ${esc(model.method)}</span></div><div class="table-wrap"><table class="audit-table"><thead><tr><th>Feature</th><th>Live value</th><th>Historical mean</th><th>Historical SD</th><th>Standardized z</th><th>Coefficient</th><th>Contribution MT</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.name)}</td><td class="num">${fmt(row.value,3)} ${row.unit}</td><td class="num">${fmt(row.mean,3)}</td><td class="num">${fmt(row.sd,3)}</td><td class="num">${fmt(row.z,4)}</td><td class="num">${fmt(row.coefficient,4)}</td><td class="num"><strong>${row.contribution>=0?"+":""}${fmt(row.contribution,2)}</strong></td></tr>`).join("")}<tr class="audit-total"><td colspan="6">Model intercept</td><td class="num"><strong>${fmt(model.beta[0],2)} MT</strong></td></tr></tbody></table></div><div class="audit-equations"><div><span>Global prediction</span><strong>${fmt(model.beta[0],2)} + Σ(feature contributions) = ${fmt(reconstructed,2)} MT</strong></div><div><span>Local anchor correction</span><strong>${fmt(local,2)} MT</strong></div><div><span>Complete prediction</span><strong>${fmt(reconstructed,2)} + ${fmt(local,2)} = ${fmt(predicted,2)} MT</strong></div><div><span>Completion uplift</span><strong>${fmt(predicted,2)} − ${fmt(core,2)} = ${fmt(uplift,2)} MT (${fmt(upliftPct,2)}%)</strong></div></div><div class="audit-bottom"><div><h3>Model validation statistics</h3><dl><dt>LOOCV MAPE</dt><dd>${fmt(v.loocvMapePct,2)}%</dd><dt>Repeated 3-fold median MAPE</dt><dd>${fmt(v.repeated3FoldMedianMapePct,2)}%</dd><dt>Bootstrap OOB median MAPE</dt><dd>${fmt(v.bootstrapOobMedianMapePct,2)}%</dd><dt>Cross-project phase MAPE</dt><dd>${(v.crossProjectPhaseMapePct||[]).map(x=>fmt(x,2)+"%").join(" / ")}</dd></dl></div><div><h3>Domain & governance warnings</h3><ul>${warningList}</ul><p>${esc(model.governance||"")}</p></div></div>`;
    const signed=value=>`${value>=0?"+":"−"} ${fmt(Math.abs(value),2)}`;
    const expanded=`${fmt(model.beta[0],2)} ${rows.map(row=>signed(row.contribution)).join(" ")} = ${fmt(reconstructed,2)} MT`;
    box.insertAdjacentHTML("beforeend",`<section class="audit-contribution-steps"><h3>Step-by-step feature contributions</h3><p>For every feature: <strong>Contribution = coefficient × standardized z-value</strong>, where <strong>z = (live value − historical mean) ÷ historical SD</strong>.</p><ol>${rows.map(row=>`<li><strong>${esc(row.name)}</strong><span>z = (${fmt(row.value,3)} − ${fmt(row.mean,3)}) ÷ ${fmt(row.sd,3)} = ${fmt(row.z,4)}</span><span>Contribution = ${fmt(row.coefficient,4)} × ${fmt(row.z,4)} = <strong>${signed(row.contribution)} MT</strong></span></li>`).join("")}</ol><div class="audit-expanded-equation"><span>Expanded global prediction</span><strong>${expanded}</strong></div></section>`);
  }

  function renderMto(r){
    $("coreMto").textContent=fmtMT(r.mto.totalMT);
    $("calibratedWeight").textContent=fmtMT(r.calibrated.predictedEmptyWeightMT);
    $("class3WeightRange").textContent=r.cost?.weightRange?`${fmt(r.cost.weightRange.low,2)}–${fmt(r.cost.weightRange.high,2)} MT`:"HOLD";
    $("validationVariance").textContent=r.validation.available?`${fmt(r.validation.variancePct,2)}% · ${r.validation.status}`:"Not entered";
    $("mtoTable").querySelector("tbody").innerHTML=r.mto.rows.map(x=>`<tr><td>${esc(x.component)}</td><td>${esc(x.basis)}</td><td class="num">${fmt(x.quantity,2)} ${esc(x.quantityUnit)}</td><td>${esc(x.thickness)}</td><td class="num"><strong>${fmt(x.weightMT,2)}</strong></td></tr>`).join("");
    const completionUpliftPct=r.calibrated.coreMtoMT>0?(r.calibrated.completionUpliftMT/r.calibrated.coreMtoMT)*100:null;
    const calibrationRows=r.calibrated.mode==="SMALL_TANK_CORE_FACTOR"?[["Model","Small Tank Core Factor"],["Core MTO",fmtMT(r.calibrated.coreMtoMT)],["Small-tank factor",`${fmt(r.calibrated.smallTankFactor,2)} ×`],["Complete prediction",fmtMT(r.calibrated.predictedEmptyWeightMT)],["Completion uplift",`${fmtMT(r.calibrated.completionUpliftMT)}${completionUpliftPct===null?"":` (${fmt(completionUpliftPct,2)}% of Core MTO)`}`],["Global ridge diagnostic",`${fmtMT(r.calibrated.globalPredictionMT)} (not used)`]]:[["Model",esc(r.calibrated.mode||"-")],["Core MTO",fmtMT(r.calibrated.coreMtoMT)],["Global prediction",fmtMT(r.calibrated.globalPredictionMT)],["Local correction",fmtMT(r.calibrated.localAnchorCorrectionMT)],["Complete prediction",fmtMT(r.calibrated.predictedEmptyWeightMT)],["Completion uplift",`${fmtMT(r.calibrated.completionUpliftMT)}${completionUpliftPct===null?"":` (${fmt(completionUpliftPct,2)}% of Core MTO)`}`]];
    defs("calibrationDetails",calibrationRows);
    const ds=(r.calibrated.domain?.issues||[]).map(x=>({text:x,cls:"warning-note"}));
    if(r.eligibility.status==="SCREENING") ds.unshift({html:"<strong>CLASS 3 SCREENING:</strong> weight is available for budget estimating, while detailed engineering may remain HOLD.",cls:"screening-note"});
    notes("calibrationNotes",ds.length?ds:[{text:"Calibration domain check has no additional warnings."}]);
    renderCalibrationAudit(r);
    renderMtoEquationFlow(r);
  }

  function renderCost(r){
    const c=r.cost;
    if(!c?.available){
      $("rawSteelBasisCost").textContent=$("supplyBillingCost").textContent=$("nonSupplyLSTKCost").textContent=$("baseLSTKCost").textContent="HOLD";
      defs("costDetails",[["Status","HOLD"],["Reason",esc(c?.governance||"No eligible weight estimate")]]);
      $("costRangeTableBody").innerHTML="";
      renderCostEquationFlow(r);
      return;
    }
    $("rawSteelBasisCost").textContent=fmtCr(c.rawSteelBasisCr);
    $("supplyBillingCost").textContent=fmtCr(c.supplyBillingCostCr);
    $("nonSupplyLSTKCost").textContent=fmtCr(c.nonSupplyLSTKBillingCostCr);
    $("baseLSTKCost").textContent=fmtCr(c.selectedLSTKCostCr);
    defs("costDetails",[
      ["Weight basis",fmtMT(c.weightBasisMT)],
      ["Raw steel normalization rate",`₹${fmt(c.rawSteelRate,2)}/kg`],
      ["PO Supply Billing Index",fmt(c.supplyBillingIdiotIndex,2)],
      ["Non-supply LSTK Billing Index",fmt(c.nonSupplyLSTKBillingIdiotIndex,2)],
      ["Base LSTK Index",fmt(c.baseLSTKIdiotIndex,2)],
      ["Reference LSTK Index",fmt(c.referenceLSTKIdiotIndex,2)],
      ["Supply billing share of Base LSTK",`${fmt(c.supplyBillingShareOfBasePct,2)}%`],
      ["Non-supply share of Base LSTK",`${fmt(c.nonSupplyShareOfBasePct,2)}%`],
      ["Foundation / civil in historical Base LSTK",c.foundationCivilIncluded?"Yes":"Review"],
      ["Selected quantity total",fmtCr(c.quantitySelectedLSTKCostCr)]
    ]);
    notes("costNotes",[
      {text:c.governance},
      {text:"The non-supply LSTK value is the historical Engineering + Construction billing remainder. It includes broad installed scope and must not be interpreted as erection labour only."},
      c.includeGroundReference?{text:"Reference LSTK is selected. The additional normalized increment is based on the directly attributable DHT ground-improvement line in the audit dataset."}:null
    ]);
    const rows=[
      ["PO Supply Billing benchmark",c.supplyBillingRange,c.supplyBillingIdiotIndex],
      ["Non-supply LSTK billing remainder",c.nonSupplyLSTKRange,c.nonSupplyLSTKBillingIdiotIndex],
      [c.includeGroundReference?"Reference LSTK installed package":"Base LSTK installed package",c.lstkRange,c.includeGroundReference?c.referenceLSTKIdiotIndex:c.baseLSTKIdiotIndex]
    ];
    $("costRangeTableBody").innerHTML=rows.map(([name,rg,f])=>`<tr><td>${esc(name)}</td><td>${fmtCr(rg.low/1e7)}</td><td>${fmtCr(rg.base/1e7)}</td><td>${fmtCr(rg.high/1e7)}</td><td>${fmt(f,6)}</td></tr>`).join("");
    renderCostEquationFlow(r);
  }

  function scenarioSeed(){ const x=collectInput(); return {level:x.designLevel,sg:x.designSG,bottomShellCA:x.caBottomShell,upperShellCA:x.caUpperShell,steelRate:x.rawSteelRateOverride||56.5,material:x.shellMaterial,roofType:x.roofType,roofSubtype:x.floatingRoofSubtype||"single",mode:x.calculationMode}; }
  function scenarioEnsure(){ if(scenarioSlots) return; const seed=scenarioSeed(); scenarioSlots={base:{...seed},a:{...seed},b:{...seed},c:{...seed}}; $("scenarioMaterial").innerHTML=Object.entries(E.materials).map(([key,m])=>`<option value="${esc(key)}">${esc(m.label)}</option>`).join(""); }
  function scenarioInput(slot){
    const x=collectInput();
    x.designLevel=slot.level; x.hydroLevel=Math.max(slot.level,x.hydroLevel||0); x.designSG=slot.sg;
    x.caBottomShell=slot.bottomShellCA; x.caUpperShell=slot.upperShellCA; x.rawSteelRateOverride=slot.steelRate;
    x.shellMaterial=slot.material; x.shellGroup=E.resolveMaterialGroup?.(slot.material,x.shellGroup)||x.shellGroup; x.roofType=slot.roofType; x.floatingRoofSubtype=slot.roofType==="efr"?(slot.roofSubtype||"single"):"single"; x.calculationMode=slot.mode;
    x.courses=x.courses.map((c,i)=>({...c,material:slot.material,group:E.resolveMaterialGroup?.(slot.material,c.group)||c.group,ca:i===0?slot.bottomShellCA:slot.upperShellCA}));
    if(slot.roofType!=="efr") x.floatingRoofSubtype="single";
    return x;
  }
  function scenarioResult(key){ try{return E.runDesign(scenarioInput(scenarioSlots[key]));}catch(err){return {error:err.message||String(err)};} }
  function scenarioOutput(id,value){ $(id).value=value; $(id+"Out").value=value; $(id+"Out").textContent=id==="scenarioSteelRate"?`₹${fmt(value,2)}/kg`:id==="scenarioLevel"?`${fmt(value,2)} m`:id==="scenarioSG"?fmt(value,3):`${fmt(value,2)} mm`; }
  function scenarioLoadControls(){ if(activeScenario==="base"){scenarioSlots.base.roofType=$("roofType").value;scenarioSlots.base.roofSubtype=$("floatingRoofSubtype").value||"single";} const s=scenarioSlots[activeScenario]; scenarioOutput("scenarioLevel",s.level); scenarioOutput("scenarioSG",s.sg); scenarioOutput("scenarioBottomShellCA",s.bottomShellCA); scenarioOutput("scenarioUpperShellCA",s.upperShellCA); scenarioOutput("scenarioSteelRate",s.steelRate); $("scenarioMaterial").value=s.material; $("scenarioRoofType").value=s.roofType==="efr"?`efr-${s.roofSubtype||"single"}`:s.roofType; $("scenarioMode").value=s.mode; document.querySelectorAll(".scenario-tab").forEach(b=>b.classList.toggle("active",b.dataset.scenario===activeScenario)); }
  function scenarioRender(){
    if(!$("scenarioCompareBody")) return; scenarioEnsure(); const results=Object.fromEntries(Object.keys(scenarioSlots).map(k=>[k,scenarioResult(k)])); const active=results[activeScenario], labels={base:"Base case",a:"Scenario A",b:"Scenario B",c:"Scenario C"};
    if(active.error){ $("scenarioWeight").textContent=$("scenarioCost").textContent=$("scenarioBottomCourse").textContent="HOLD"; $("scenarioStatus").textContent="ERROR"; $("scenarioNote").textContent=active.error; }
    else { const c=active.cost; $("scenarioWeight").textContent=fmtMT(active.calibrated.predictedEmptyWeightMT); $("scenarioCost").textContent=c?.available?fmtCr(c.selectedLSTKCostCr??c.selectedCompleteCostCr):"HOLD"; $("scenarioBottomCourse").textContent=active.shell.courses[0]?`${fmt(active.shell.courses[0].recommended,2)} mm`:"–"; $("scenarioStatus").textContent=active.overall.estimateStatus; $("scenarioNote").textContent=`${labels[activeScenario]} is a temporary comparison. Active TankM case inputs are unchanged.`; }
    $("scenarioCompareBody").innerHTML=Object.entries(results).map(([k,r])=>{const s=scenarioSlots[k];const material=E.materials[s.material]?.label||s.material;return `<tr class="${k===activeScenario?"scenario-current":""}"><td>${labels[k]}</td><td>${fmt(s.level,2)} m</td><td>${fmt(s.sg,3)}</td><td>${fmt(s.bottomShellCA,2)} / ${fmt(s.upperShellCA,2)} mm</td><td>${esc(material)}</td><td>${r.error?"HOLD":fmtMT(r.calibrated.predictedEmptyWeightMT)}</td><td>${r.error||!r.cost?.available?"HOLD":fmtCr(r.cost.selectedLSTKCostCr??r.cost.selectedCompleteCostCr)}</td><td>${r.error?"ERROR":esc(r.overall.estimateStatus)}</td></tr>`;}).join("");
    const valid=Object.entries(results).filter(([,r])=>!r.error&&Number.isFinite(r.calibrated.predictedEmptyWeightMT));const max=Math.max(1,...valid.map(([,r])=>r.calibrated.predictedEmptyWeightMT)); $("scenarioBars").innerHTML=Object.entries(results).map(([k,r])=>{const weight=!r.error?r.calibrated.predictedEmptyWeightMT:null;return `<div class="scenario-bar"><span>${labels[k]}</span><div><i style="width:${weight==null?0:Math.max(4,weight/max*100)}%"></i></div><strong>${weight==null?"HOLD":fmtMT(weight)}</strong></div>`;}).join("");
  }
  function scenarioUpdateFromControls(){ const s=scenarioSlots[activeScenario]; s.level=Number($("scenarioLevel").value); s.sg=Number($("scenarioSG").value); s.bottomShellCA=Number($("scenarioBottomShellCA").value); s.upperShellCA=Number($("scenarioUpperShellCA").value); s.steelRate=Number($("scenarioSteelRate").value); s.material=$("scenarioMaterial").value; const roofSelection=$("scenarioRoofType").value; s.roofType=roofSelection.startsWith("efr-")?"efr":roofSelection; s.roofSubtype=roofSelection==="efr-double"?"double":"single"; s.mode=$("scenarioMode").value; scenarioLoadControls(); scenarioRender(); }
  function scenarioInit(){
    if(!$("scenarioCompareBody")) return; scenarioEnsure(); scenarioLoadControls(); scenarioRender();
    if($("scenarioCompareBody").dataset.bound) return; $("scenarioCompareBody").dataset.bound="1";
    document.querySelectorAll(".scenario-tab").forEach(btn=>btn.addEventListener("click",()=>{activeScenario=btn.dataset.scenario;scenarioLoadControls();scenarioRender();}));
    ["scenarioLevel","scenarioSG","scenarioBottomShellCA","scenarioUpperShellCA","scenarioSteelRate","scenarioMaterial","scenarioRoofType","scenarioMode"].forEach(id=>$(id).addEventListener("input",()=>{if(checked("scenarioAutoRun"))scenarioUpdateFromControls();}));
    $("scenarioAutoRun").addEventListener("change",()=>{if(checked("scenarioAutoRun"))scenarioUpdateFromControls();});
    $("scenarioRunBtn").addEventListener("click",scenarioUpdateFromControls);
  }

  function renderValidation(r){
    const v=r.validation;
    defs("caseValidation",v.available?[["Actual / As-Built",fmtMT(v.actualEmptyWeightMT)],["TankM prediction",fmtMT(v.predictedEmptyWeightMT)],["Difference",fmtMT(v.differenceMT)],["Variance",`${fmt(v.variancePct,2)}%`],["Class 3 test",`<span class="pill ${v.withinClass3?"ok":"review"}">${v.status}</span>`],["Geometry basis",esc(v.geometryBasis)],["Design vintage",esc(v.designCodeVintage)]]:[["Actual / As-Built","Not entered"],["Current estimate status",esc(r.overall.estimateStatus)]]);
    const a=window.TankMCalibration?.IFR_SMALL_ANCHOR;
    defs("anchorValidation",a?[["Anchor ID",esc(a.id)],["Roof type",esc(a.roofType.toUpperCase())],["Diameter",`${fmt(a.diameterM,2)} m`],["Core MTO",fmtMT(a.coreMtoMT)],["Actual empty",fmtMT(a.actualEmptyWeightMT)],["Status",esc(a.calibrationStatus)]]:[["Calibration","Unavailable"]]);
    scenarioInit();
  }

  function renderReport(r){
    $("reportTitle").textContent="Preliminary Tank Engineering & Class 3 Owner Cost Report";
    $("reportCaseSubtitle").textContent=`Case: ${r.input.caseName||"Unnamed case"}`;
    const c=r.cost,v=r.validation,now=new Date();
    const pill=s=>`<span class="pill ${statusClass(s)}">${esc(s)}</span>`;
    const fabrication="NO";
    const decision=r.overall.estimateStatus==="SCREENING"?"CLASS 3 SCREENING AVAILABLE":r.overall.estimateStatus==="OK"?"SCREENING ESTIMATE AVAILABLE":"ESTIMATE WITHHELD";
    const decisionText=r.overall.estimateStatus==="SCREENING"?"A Class 3 owner estimate is available with explicitly disclosed screening assumptions. Engineering design closure remains required.":r.overall.estimateStatus==="OK"?"TankM has completed its implemented screening checks for this case. Detailed engineering closure remains required before release.":"TankM has withheld the Class 3 estimate until the identified engineering inputs or scope gates are resolved.";
    const weightDiff=Number.isFinite(Number(r.calibrated.predictedEmptyWeightMT))?r.calibrated.predictedEmptyWeightMT-r.mto.totalMT:null;
    const assumptions=[...(r.assumptions||[]),...(r.calibrated.domain?.issues||[])];
    const assumptionRows=assumptions.length?assumptions.map((item,i)=>`<tr><td>A-${String(i+1).padStart(2,"0")}</td><td>${esc(item)}</td><td>${/geometry/i.test(item)?"Geometry":"Engineering / model"}</td><td>${/geometry|diameter|roof|weight/i.test(item)?"Potential weight and cost impact":"Engineering closure required"}</td><td>Confirm with controlled project data</td></tr>`).join(""):`<tr><td>A-01</td><td>No additional model assumptions beyond entered project data.</td><td>Record</td><td>None identified</td><td>Maintain input audit trail</td></tr>`;
    const closure=r.gates.filter(g=>g.severity!=="OK").map((g,i)=>`<li><strong>${i+1}. ${esc(g.title)}:</strong> ${esc(g.detail)}</li>`).join("")||"<li>No additional TankM closure items are currently flagged.</li>";
    const screeningNote=r.shell.screeningProxyUsed?"Large-diameter shell values in this report are non-code estimating proxies only. They are not API 650 fabrication-release thicknesses.":"TankM's shell calculation is within its implemented diameter gate, subject to the listed engineering-review items.";
    $("reportBody").innerHTML=`
      <article class="owner-report">
        <div class="owner-report-title"><h2>TankM</h2><h3>Preliminary Tank Engineering &amp; Class 3 Owner Cost Report</h3><p>Design → Engineering Screening → Weight Intelligence → Owner Cost</p></div>
        <table class="owner-table"><tbody><tr><th>Report / Case ID</th><td>${esc(r.input.caseName||"Unnamed case")}</td></tr><tr><th>Calculation Mode</th><td>${esc(r.eligibility.calculationMode)}</td></tr><tr><th>Engineering Status</th><td>${pill(r.overall.engineeringStatus)}</td></tr><tr><th>Estimate Status</th><td>${pill(r.overall.estimateStatus)}</td></tr><tr><th>Fabrication Design Release</th><td>${pill(fabrication)}</td></tr><tr><th>Report Date</th><td>${now.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"})}</td></tr><tr><th>Revision</th><td>Rev. 0</td></tr></tbody></table>
        <section><h2>1. Executive Decision Summary</h2><div class="owner-decision ${statusClass(r.overall.estimateStatus)}"><strong>OWNER DECISION STATUS: ${decision}</strong><p>${decisionText}</p></div><h3>Key Owner Metrics</h3><table class="owner-table metric-table"><tbody><tr><th>Core Engineering MTO</th><td>${fmtMT(r.mto.totalMT)}</td></tr><tr><th>Predicted Complete Empty Weight</th><td>${fmtMT(r.calibrated.predictedEmptyWeightMT)}</td></tr><tr><th>Class 3 Lower / Upper Range</th><td>${c?.weightRange?`${fmtMT(c.weightRange.low)} / ${fmtMT(c.weightRange.high)}`:"HOLD"}</td></tr><tr><th>PO Supply Billing Benchmark</th><td>${c?.available?fmtCr(c.supplyBillingCostCr):"HOLD"}</td></tr><tr><th>Non-supply LSTK Billing Remainder</th><td>${c?.available?fmtCr(c.nonSupplyLSTKBillingCostCr):"HOLD"}</td></tr><tr><th>${c?.includeGroundReference?"Reference LSTK Package Cost":"Base LSTK Package Cost"}</th><td>${c?.available?fmtCr(c.selectedLSTKCostCr):"HOLD"}</td></tr><tr><th>Number of Tanks</th><td>${r.input.tankQuantity}</td></tr><tr><th>Total Selected LSTK Cost</th><td>${c?.available?fmtCr(c.quantitySelectedLSTKCostCr):"HOLD"}</td></tr></tbody></table><div class="owner-use"><div><strong>Suitable for</strong><p>Owner-side Class 3 screening, option evaluation, budget development and early investment decision support.</p></div><div><strong>Not suitable for</strong><p>IFC design, fabrication release, final procurement quantity or construction execution without controlled detailed-engineering closure.</p></div></div></section>
        <section><h2>2. Engineering Screening Status</h2><table class="owner-table"><thead><tr><th>Engineering Check</th><th>Status</th><th>TankM Assessment</th><th>Required Action</th></tr></thead><tbody>${r.gates.map(g=>`<tr><td>${esc(g.title)}</td><td>${pill(g.severity)}</td><td>${esc(g.detail)}</td><td>${g.severity==="OK"?"None at screening stage":"Complete controlled detailed engineering review"}</td></tr>`).join("")}</tbody></table></section>
        <section><h2>3. Weight Intelligence</h2><h3>Weight Development</h3><table class="owner-table"><tbody><tr><th>Core Engineering MTO</th><td>${fmtMT(r.mto.totalMT)}</td></tr><tr><th>Difference to Predicted Complete Weight</th><td>${weightDiff==null?"HOLD":`${weightDiff>=0?"+":""}${fmtMT(weightDiff)}`}</td></tr><tr><th>TankM Predicted Complete Empty Weight</th><td>${fmtMT(r.calibrated.predictedEmptyWeightMT)}</td></tr></tbody></table><div class="owner-range">${c?.weightRange?`<strong>Class 3 Weight Envelope</strong><span>Lower: ${fmtMT(c.weightRange.low)}</span><span>Base prediction: ${fmtMT(c.weightRange.base)}</span><span>Upper: ${fmtMT(c.weightRange.high)}</span>`:"<strong>Class 3 Weight Envelope: HOLD</strong>"}</div><p>The complete empty-weight prediction is the owner-side screening basis. The core MTO represents only explicitly modelled quantities.</p></section>
        <section><h2>4. Owner Cost Intelligence</h2>${c?.available?`<table class="owner-table"><thead><tr><th>Historical Cost Layer</th><th>Amount</th><th>Interpretation</th></tr></thead><tbody><tr><td>PO Supply Billing Benchmark</td><td>${fmtCr(c.supplyBillingCostCr)}</td><td>Procurement billing benchmark; not pure fabrication</td></tr><tr><td>Non-supply LSTK Billing Remainder</td><td>${fmtCr(c.nonSupplyLSTKBillingCostCr)}</td><td>Engineering + Construction billing remainder; includes broad installed scope</td></tr><tr class="total-row"><td>${c.includeGroundReference?"Reference LSTK Installed Package":"Base LSTK Installed Package"}</td><td>${fmtCr(c.selectedLSTKCostCr)}</td><td>Historical scope class: ${esc(c.poScopeClass)}</td></tr></tbody></table><p><strong>Quantity:</strong> ${c.tankQuantity} tank(s) &nbsp; <strong>Selected LSTK cost per tank:</strong> ${fmtCr(c.selectedLSTKCostCr)} &nbsp; <strong>Total selected LSTK cost:</strong> ${fmtCr(c.quantitySelectedLSTKCostCr)}</p><p class="muted small">Historical Base LSTK includes foundation/civil and multidisciplinary installed works. Apply this factor only when the project scope is comparable.</p>`:"<p>Cost is withheld because an eligible complete weight is unavailable.</p>"}</section>
        <section><h2>5. Assumption Register</h2><table class="owner-table"><thead><tr><th>ID</th><th>Assumption</th><th>Type</th><th>Impact</th><th>Closure</th></tr></thead><tbody>${assumptionRows}</tbody></table></section>
        <section><h2>6. Engineering Closure Register</h2><h3>Review items before detailed design / procurement</h3><ol class="owner-closure">${closure}</ol></section>
        <section><h2>7. Governance Statement</h2><div class="owner-governance"><p>TankM is an <strong>owner-side engineering and Class 3 cost-intelligence tool</strong>.</p><p>${screeningNote}</p><p>The historical cost factors are LSTK package billing normalizations. Base LSTK includes foundation/civil and multidisciplinary installed works; the PO Supply Billing factor is not a pure fabrication multiplier.</p><p>The output shall not be treated as fabrication design. Detailed shell analysis, roof-member design, wind buckling, seismic design, anchorage, opening reinforcement and other fabrication-level requirements require controlled engineering closure.</p></div></section>
        <section><h2>8. Audit Trail</h2><table class="owner-table"><tbody><tr><th>Calculation Engine</th><td>TankM</td></tr><tr><th>Calculation Mode</th><td>${esc(r.eligibility.calculationMode)}</td></tr><tr><th>Engineering Status</th><td>${pill(r.overall.engineeringStatus)}</td></tr><tr><th>Estimate Status</th><td>${pill(r.overall.estimateStatus)}</td></tr><tr><th>Weight Model</th><td>${esc(r.calibrated.modelVersion||r.calibrated.mode||"Controlled model")}</td></tr><tr><th>Code Basis</th><td>API 650 screening basis; detailed release excluded</td></tr><tr><th>Generated Date / Time</th><td>${now.toLocaleString()}</td></tr><tr><th>Generated By</th><td>Browser user</td></tr></tbody></table><p class="owner-confidential">Confidentiality: owner calibration data and commercial benchmark data shall remain in a controlled/private environment unless specifically cleared for external release.</p></section>
      </article>`;
  }

  function render(r){ lastResult=r; setStatus(); renderGeometryEquationFlow(r); renderShell(r); renderBottom(r); renderRoof(r); renderWind(r); renderPressure(r); renderSeismic(r); renderOpenings(r); renderMto(r); renderCost(r); renderValidation(r); renderReport(r); }
  function synchroniseInferredGeometry(){
    const input=collectInput();
    if(!String(input.geometryBasis||"").toLowerCase().includes("inferred")) return false;
    const g=E.inferGeometryFromCapacity(input);
    if(!g.available) return false;
    $("diameter").value=g.diameterM.toFixed(2);
    $("shellHeight").value=g.shellHeightM.toFixed(2);
    generateCourses();
    return true;
  }
  function run(){
    try{ synchroniseInferredGeometry(); const input=collectInput(); if(!input.courses.length) generateCourses(); const finalInput=collectInput(); render(E.runDesign(finalInput)); markEstimateUpdated(); }
    catch(err){ console.error(err); $("overallStatus").textContent="ERROR"; $("overallStatus").className="status hold"; $("overallStatusText").textContent=err.message||String(err); }
  }

  function inferGeometry(){
    const x=collectInput();
    const g=E.inferGeometryFromCapacity(x);
    if(!g.available){ alert(g.note); return; }
    $("diameter").value=g.diameterM.toFixed(2); $("shellHeight").value=g.shellHeightM.toFixed(2); $("geometryBasis").value="Inferred from capacity";
    if(g.diameterM>61) $("calculationMode").value="class3-screening";
    generateCourses();
    $("overallStatusText").textContent=`Inferred D ${g.diameterM.toFixed(2)} m and shell height ${g.shellHeightM.toFixed(2)} m. Review assumptions before running.`;
  }

  function wizardStatus(message,kind=""){
    const box=$("wizardStatus");box.textContent=message;box.className=`wizard-status ${kind}`;
  }
  function setWizardExample(){
    const values={wizardCaseName:"60,000 m³ crude oil screening",wizardLiquid:"Crude oil",wizardQuantity:10,wizardCapacity:60000,wizardLevel:17.75,wizardSG:0.888,wizardTemp:65,wizardMdmt:11.3,wizardWind:65,wizardWindUnit:"ms",wizardRoof:"efr-double",wizardBottomShellCA:3,wizardUpperShellCA:1.5,wizardBottomCA:3,wizardRoofCA:1};
    Object.entries(values).forEach(([id,value])=>{$(id).value=value;});$("wizardSeismic").checked=true;$("actualEmptyWeightMT").value=1550;
    wizardStatus("Example loaded with 1,550 MT Actual / As-Built empty weight. Click “Check & apply datasheet values”, run the design, then open Validation Lab for comparison.","ok");
    markCaseDirty();
  }
  function applyDatasheetValues(){
    const capacity=num("wizardCapacity"),level=num("wizardLevel"),sg=num("wizardSG"),quantity=num("wizardQuantity"),wind=num("wizardWind"),temp=num("wizardTemp"),roof=val("wizardRoof");
    const missing=[];if(capacity<=0)missing.push("stored capacity");if(level<=0)missing.push("design / hydrotest level");if(sg<=0)missing.push("design SG");if(quantity<1)missing.push("tank quantity");if(val("wizardWind")==="")missing.push("wind speed");if(val("wizardTemp")==="")missing.push("design temperature");
    if(missing.length){wizardStatus(`Cannot apply: enter ${missing.join(", ")}.`,"error");return;}
    const set=(id,value)=>{$(id).value=value;};
    const windKmh=val("wizardWindUnit")==="ms"?wind*3.6:wind;
    const roofMap={"efr-double":["efr","double"],"efr-single":["efr","single"],ifr:["ifr","single"],fixed:["fixed","single"]}[roof];
    set("caseName",val("wizardCaseName")||"Datasheet screening case");set("storedLiquid",val("wizardLiquid")||"Not stated");set("tankQuantity",quantity);set("calculationMode","class3-screening");set("geometryBasis","Inferred from capacity");set("shellMaterial",E.DEFAULT_SHELL_MATERIAL||"A537M-C1");set("shellGroup",E.DEFAULT_SHELL_GROUP||"VI");syncMaterialGroup($("shellMaterial"),$("shellGroup"));set("nominalCapacityM3",capacity);set("storedCapacityM3",capacity);set("designLevel",level);set("hydroLevel",level);set("designSG",sg);set("designTemp",temp);set("mdmt",num("wizardMdmt"));set("windSpeed",windKmh.toFixed(1));set("roofType",roofMap[0]);set("floatingRoofSubtype",roofMap[1]);set("caBottomShell",num("wizardBottomShellCA"));set("caUpperShell",num("wizardUpperShellCA"));set("bottomCA",num("wizardBottomCA"));set("annularCA",num("wizardBottomCA"));set("roofCA",num("wizardRoofCA"));set("courseHeight",2.5);set("floatingRoofKgM2",0);$("seismic").checked=$("wizardSeismic").checked;
    inferGeometry();
    if(/60,000/.test(val("wizardCaseName"))){set("diameter", "66.00");set("shellHeight", "19.50");set("geometryBasis", "Confirmed GA");}
    generateCourses();
    const assumptions=["geometry inferred from capacity and liquid level",`shell defaults to ${E.materials[E.DEFAULT_SHELL_MATERIAL]?.label||"ASTM A537M Class 1"} / Group ${E.DEFAULT_SHELL_GROUP||"VI"} unless controlled project data overrides it`,"wind girder, nozzle and manhole weights remain zero until verified"];
    if(roof==="efr-double")assumptions.push("double-deck EFR will use the disclosed 115.8 kg/m² screening basis unless you enter a verified value");
    wizardStatus(`Applied successfully. Wind converted to ${windKmh.toFixed(1)} km/h. Review: ${assumptions.join("; ")}.`,"warn");
    markCaseDirty();
  }

  function download(name,text,type="text/plain"){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
  function caseFileName(){ const name=(val("caseName")||"Untitled_Case").trim().replace(/[^a-z0-9_-]+/gi,"_").replace(/^_+|_+$/g,"")||"Untitled_Case"; return `TankM_${name}_${new Date().toISOString().slice(0,10)}.json`; }
  function saveCaseFile(){ const payload={format:"TankM Case",schemaVersion:2,savedAt:new Date().toISOString(),input:collectInput()}; download(caseFileName(),JSON.stringify(payload,null,2),"application/json"); $("overallStatusText").textContent="TankM case JSON file downloaded."; }
  async function loadCaseFile(file){
    if(!file) return;
    try{
      const payload=JSON.parse(await file.text());
      if(payload?.schemaVersion!=null&&![1,2].includes(payload.schemaVersion)) throw new Error(`Unsupported TankM case version: ${payload.schemaVersion}`);
      const input=payload?.input??payload;
      if(!input||typeof input!=="object"||Array.isArray(input)||(!("caseName" in input)&&!("diameter" in input))) throw new Error("This is not a valid TankM case file.");
      loadInput(input); scenarioSlots=null; activeScenario="base"; run();
      $("overallStatusText").textContent=`Loaded ${file.name} and recalculated the case.`;
    }catch(err){
      $("overallStatusText").textContent=`Case load failed: ${err.message||err}`;
      window.alert(`TankM could not load this case file.\n\n${err.message||err}`);
    }finally{$("caseFileInput").value="";}
  }
  function exportJson(){ if(lastResult) download("tankm-result.json",JSON.stringify(lastResult,null,2),"application/json"); }
  function csvCell(x){ const s=String(x??""); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
  function exportMto(){ if(!lastResult) return; const rows=[["Component","Basis","Quantity","Unit","Thickness/Rate","Weight MT"],...lastResult.mto.rows.map(r=>[r.component,r.basis,r.quantity,r.quantityUnit,r.thickness,r.weightMT])]; download("tankm-mto.csv",rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv"); }
  function exportCost(){ if(!lastResult?.cost?.available) return; const c=lastResult.cost; const rows=[["Layer","Factor","Cost INR","Cost Cr","Scope interpretation"],["Raw steel normalization basis",1,c.rawSteelBasisINR,c.rawSteelBasisCr,"Normalization denominator"],["PO Supply Billing benchmark",c.supplyBillingIdiotIndex,c.supplyBillingCostINR,c.supplyBillingCostCr,"Procurement billing benchmark; not pure fabrication"],["Non-supply LSTK billing remainder",c.nonSupplyLSTKBillingIdiotIndex,c.nonSupplyLSTKBillingCostINR,c.nonSupplyLSTKBillingCostCr,"Engineering + Construction billing remainder; broad installed scope"],["Base LSTK installed package",c.baseLSTKIdiotIndex,c.baseLSTKCostINR,c.baseLSTKCostCr,"Includes foundation/civil and multidisciplinary installed scope"],["Reference LSTK installed package",c.referenceLSTKIdiotIndex,c.referenceLSTKCostINR,c.referenceLSTKCostCr,"Base LSTK plus normalized directly attributable ground-improvement reference"]]; download("tankm-lstk-cost.csv",rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv"); }

  function navInit(){ document.querySelectorAll(".nav-btn").forEach(btn=>{btn.dataset.navLabel=btn.textContent.trim();btn.title=btn.textContent.trim();btn.setAttribute("aria-label",btn.textContent.trim());btn.addEventListener("click",()=>{document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active-panel"));btn.classList.add("active");$(btn.dataset.target)?.classList.add("active-panel");document.body.classList.toggle("home-active",btn.dataset.target==="home");window.scrollTo({top:0,behavior:"smooth"});});}); }
  function sidebarInit(){const button=$("sidebarToggleBtn");if(!button)return;const set=collapsed=>{document.body.classList.toggle("sidebar-collapsed",collapsed);button.setAttribute("aria-expanded",String(!collapsed));button.setAttribute("aria-label",collapsed?"Open sidebar":"Collapse sidebar");localStorage.setItem("TankM_sidebarCollapsed",collapsed?"1":"0");};set(localStorage.getItem("TankM_sidebarCollapsed")==="1");button.addEventListener("click",()=>set(!document.body.classList.contains("sidebar-collapsed")));}
  function openPanel(target,scrollBehavior="smooth"){document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.target===target));document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active-panel"));$(target)?.classList.add("active-panel");document.body.classList.toggle("home-active",target==="home");window.scrollTo({top:0,behavior:scrollBehavior});}
  function bind(){
    $("runBtn").addEventListener("click",run); $("generateCoursesBtn").addEventListener("click",()=>{generateCourses();markCaseDirty();}); $("inferGeometryBtn").addEventListener("click",()=>{inferGeometry();markCaseDirty();});
    $("demoBtn")?.addEventListener("click",()=>{loadInput(E.calibrationDemoInput());run();});
    $("saveBtn").addEventListener("click",saveCaseFile);
    $("loadBtn").addEventListener("click",()=>$("caseFileInput").click());
    $("caseFileInput").addEventListener("change",event=>loadCaseFile(event.target.files?.[0]));
    $("newCaseBtn").addEventListener("click",()=>{if(window.confirm("Start a new case? Unsaved input changes will be cleared.")) window.location.reload();});
    $("exportJsonBtn")?.addEventListener("click",exportJson); $("exportCsvBtn")?.addEventListener("click",exportMto); $("exportCostCsvBtn")?.addEventListener("click",exportCost); $("printBtn")?.addEventListener("click",()=>window.print());
    $("roofType").addEventListener("change",()=>{ if($("roofType").value!=="efr") $("floatingRoofSubtype").value="single"; });
    $("shellMaterial").addEventListener("change",()=>syncMaterialGroup($("shellMaterial"),$("shellGroup")));
    $("wizardExampleBtn").addEventListener("click",setWizardExample);$("applyDatasheetBtn").addEventListener("click",applyDatasheetValues);
    $("walkthroughBtn")?.addEventListener("click",()=>openPanel("walkthrough"));
    document.querySelectorAll("[data-go-to]").forEach(button=>button.addEventListener("click",event=>{event.preventDefault();openPanel(button.dataset.goTo,button.classList.contains("brand-link")?"auto":"smooth");}));
    const tracked=new Set([...scalarIds,...checkIds]);
    document.querySelector(".content")?.addEventListener("input",event=>{if(tracked.has(event.target.id)||event.target.closest?.("#courseInputTable")) markCaseDirty();});
    document.querySelector(".content")?.addEventListener("change",event=>{if(tracked.has(event.target.id)||event.target.closest?.("#courseInputTable")) markCaseDirty();});
  }

  window.TankMAI={getInput:collectInput,getResult:()=>lastResult};
  populateSelects(); navInit(); sidebarInit(); bind(); generateCourses(); run();
})();
