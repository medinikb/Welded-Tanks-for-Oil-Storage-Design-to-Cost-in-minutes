(function(){
  "use strict";
  const $ = id => document.getElementById(id);
  let providerId = "openai";
  const status = (message, kind = "") => { const el = $("aiStatus"); el.textContent = message; el.className = `ai-status ${kind}`; };
  const escapeHtml = text => String(text || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }
  function renderMarkdown(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const parts = []; let list = null;
    const closeList = () => { if (list) { parts.push(`</${list}>`); list = null; } };
    for (let index = 0; index < lines.length; index++) {
      const raw = lines[index];
      const line = raw.trim();
      if (!line) { closeList(); continue; }
      const isTableRow = /^\|.+\|$/.test(line);
      const isTableDivider = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1]?.trim() || "");
      if (isTableRow && isTableDivider) {
        closeList();
        const cells = value => value.trim().replace(/^\||\|$/g, "").split("|").map(cell => inlineMarkdown(cell.trim()));
        const headers = cells(line); index += 2;
        const rows = [];
        while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) { rows.push(cells(lines[index])); index++; }
        index--;
        parts.push(`<div class="ai-table-wrap"><table class="ai-table"><thead><tr>${headers.map(cell => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      const heading = line.match(/^#{1,3}\s+(.+)$/) || line.match(/^\*\*(.+?)\*\*:??$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
      if (heading) { closeList(); parts.push(`<h3>${inlineMarkdown(heading[1])}</h3>`); }
      else if (bullet) { if (list !== "ul") { closeList(); list = "ul"; parts.push("<ul>"); } parts.push(`<li>${inlineMarkdown(bullet[1])}</li>`); }
      else if (numbered) { if (list !== "ol") { closeList(); list = "ol"; parts.push(`<ol start="${numbered[1]}">`); } parts.push(`<li>${inlineMarkdown(numbered[2])}</li>`); }
      else { closeList(); parts.push(`<p>${inlineMarkdown(line)}</p>`); }
    }
    closeList(); return parts.join("");
  }
  async function loadProviders() {
    try {
      const data = await fetch("/api/ai/providers").then(r => r.json());
      const select = $("aiProvider");
      select.innerHTML = data.providers.map(p => `<option value="${p.id}" ${p.configured ? "" : "disabled"}>${p.label}${p.configured ? "" : " (not configured)"}</option>`).join("");
      const active = data.providers.find(p => p.configured);
      if (active) { providerId = active.id; select.value = active.id; status(`${active.label} is ready. AI suggestions never change TankM calculations automatically.`, "ok"); }
      else status("No AI provider is configured on this local server.", "error");
    } catch { status("Start TankM with npm start to use the AI assistant.", "error"); }
  }
  async function review(action) {
    const input = window.TankMAI?.getInput?.();
    const result = window.TankMAI?.getResult?.();
    if (!input) { status("Enter or load a tank case before asking the AI assistant.", "error"); return; }
    status("Reviewing the approved TankM data…"); $("aiResponse").innerHTML = "";
    try {
      const response = await fetch("/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId, action, tankInput: input, tankResult: result }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI review failed.");
      $("aiResponse").innerHTML = `<strong>${escapeHtml(data.provider)} · ${escapeHtml(data.model)}</strong><div>${renderMarkdown(data.text)}</div>`;
      status("Review complete. Confirm all assumptions with the responsible engineer.", "ok");
    } catch (error) { status(error.message, "error"); }
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("aiProvider").addEventListener("change", event => { providerId = event.target.value; });
    $("aiInputReviewBtn").addEventListener("click", () => review("review-inputs"));
    $("aiResultExplainBtn").addEventListener("click", () => review("explain-results"));
    loadProviders();
  });
})();
