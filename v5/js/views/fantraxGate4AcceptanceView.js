import { escapeHtml } from "../utils/dom.js";

const stages=["Not Started","Gate A","Preview A","Candidate Review","Protected Baseline","Ready for Next Gate"];
const text=value=>escapeHtml(value??"—");
function metric(label,value){return `<div class="metric"><span>${text(label)}</span><b>${text(value)}</b></div>`}
function statusClass(status){return status==="PASS"?"status-pass":status==="RUNNING"?"status-warning":"status-fail"}
function candidateRow(row,selectedIds,eligible){
  const id=String(row.matchedPlayerUuid||""),selected=selectedIds.includes(id),name=row.matchedPlayer?.name||row.fantraxApiPlayerId||"Unnamed player";
  return `<tr>${eligible?`<td><input type="checkbox" aria-label="Select ${text(name)}" data-gate4-candidate="${text(id)}" ${selected?"checked":""}></td>`:"<td>—</td>"}<td>${text(name)}</td><td><code>${text(id)}</code></td><td>${text(row.playerIdentityResult)}</td><td>${text(row.currentRosterStatus)}</td><td>${text(row.normalizedRosterStatus)}</td><td>${row.activeManualOverride?"Protected":"None"}</td><td>${text(row.gate4ExclusionReason||"Eligible status-only update")}</td></tr>`;
}

export function renderFantraxGate4Acceptance(state){
  const review=state.gate4Acceptance||{},artifact=review.artifact||{},checkpoints=artifact.checkpoints||{},preview=review.preview,selectedIds=review.selectedIds||[],eligible=review.eligibleRows||[],excluded=review.excludedRows||[],baseline=review.protectedBaseline;
  const authenticated=checkpoints.authenticatedUser?.evidence||{},league=checkpoints.activeLeague?.evidence||{},audit=checkpoints.auditBaseline?.evidence||{},season=preview?.data?.seasonContextComparison;
  return `<section class="view-panel">
    <h2>Gate 4 Deterministic Acceptance</h2>
    <p class="warning-note">Read-only Gate 4D-2 review. Persistence, expanded opt-in, Preview B, manifest creation, and arming are unavailable.</p>
    <div class="toolbar"><button id="startGate4Acceptance" class="primary" ${review.status==="RUNNING"?"disabled":""}>${review.stage==="NOT_STARTED"?"Start Gate 4 Acceptance Review":"Restart Read-Only Review"}</button>${review.stage==="Gate A"&&review.status==="PASS"?'<button id="fetchGate4PreviewA" class="primary">Fetch Fresh Preview A</button>':""}${review.stage==="Candidate Review"?`<button id="captureGate4ProtectedBaseline" class="primary" ${selectedIds.length!==10||review.status!=="PASS"?"disabled":""}>Capture Protected Baseline</button>`:""}</div>
    ${review.error?`<p class="warning-note" role="alert">${text(review.error)}</p>`:""}
    <div class="grid">${metric("Harness state",review.status||"NOT_STARTED")}${metric("Stage",review.stage||"NOT_STARTED")}${metric("Authenticated user",authenticated.email||authenticated.id||"UNAVAILABLE")}${metric("Active league",league.name||"UNAVAILABLE")}${metric("Audit baseline",Number.isInteger(audit.attemptCount)?`${audit.attemptCount} attempts / ${audit.itemCount} items`:"UNAVAILABLE")}${metric("Current period",preview?preview.period||"Current":"UNAVAILABLE")}${metric("Season context",season?.status||"UNAVAILABLE")}${metric("Preview A Gate B",review.previewAGateB?.status||"NOT_STARTED")}${metric("Eligible",eligible.length)}${metric("Selected",`${selectedIds.length} / 10`)}${metric("Persistence","DISABLED / UNARMED")}</div>
    <h3>Progress</h3><ol>${stages.map(stage=>`<li class="${stage===review.stage?statusClass(review.status):""}">${text(stage)}</li>`).join("")}</ol>
    ${eligible.length||excluded.length?`<h3>Candidate Review</h3><p class="note">Selection is explicit by permanent cloud UUID. The 11th player is blocked and no candidate is substituted automatically.</p><div class="table-wrap"><table><thead><tr><th>Select</th><th>Player</th><th>UUID</th><th>Identity</th><th>Cloud status</th><th>Fantrax status</th><th>Manual override</th><th>Eligibility</th></tr></thead><tbody>${eligible.map(row=>candidateRow(row,selectedIds,true)).join("")}${excluded.map(row=>candidateRow(row,selectedIds,false)).join("")}</tbody></table></div>`:""}
    ${baseline?`<h3>Protected Baseline</h3><div class="grid">${Object.entries(baseline).map(([name,value])=>metric(name,`${value.count} / ${String(value.digest).slice(0,12)}`)).join("")}</div><p class="note">Ready for the next separately authorized gate. No manifest or persistence authority exists.</p>`:""}
    <h3>Checkpoint Evidence</h3><table><thead><tr><th>Checkpoint</th><th>Status</th><th>Digest</th></tr></thead><tbody>${Object.entries(checkpoints).map(([name,item])=>`<tr><td>${text(name)}</td><td>${text(item.status)}</td><td><code>${text(item.digest)}</code></td></tr>`).join("")||'<tr><td colspan="3">Not started.</td></tr>'}</tbody></table>
  </section>`;
}
