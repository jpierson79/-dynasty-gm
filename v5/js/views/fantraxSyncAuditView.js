import { escapeHtml } from "../utils/dom.js";

export function renderFantraxSyncAudit(attempts=[]){
  const rows=(attempts||[]).slice(0,25).map(attempt=>`<tr><td>${escapeHtml(attempt.created_at||"")}</td><td>${escapeHtml(attempt.status||"")}</td><td>${escapeHtml(attempt.reviewed_count||0)}</td><td>${escapeHtml(String(attempt.manifest_digest||"").slice(0,12))}</td><td>${escapeHtml(attempt.id||"")}</td></tr>`).join("");
  return `<section class="view-panel"><h2>Fantrax Synchronization Audit</h2><p class="note">Read-only durable attempts. Incomplete attempts preserve their reviewed manifest and require all current write-time guards before recovery.</p>${rows?`<div class="table-wrap"><table><thead><tr><th>Created</th><th>Status</th><th>Reviewed</th><th>Manifest</th><th>Attempt UUID</th></tr></thead><tbody>${rows}</tbody></table></div>`:"<p class='note'>No durable synchronization attempts recorded.</p>"}</section>`;
}
