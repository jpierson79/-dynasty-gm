import { escapeHtml } from "../utils/dom.js";

export function renderFantraxSyncAudit(attempts,{status="AVAILABLE",error=""}={}){
  if(status!=="AVAILABLE"||!Array.isArray(attempts)){
    const label=status==="PERMISSION_BLOCKED"?"Permission blocked":status==="QUERY_FAILED"?"Query failed":"Unavailable";
    return `<section class="view-panel"><h2>Fantrax Synchronization Audit</h2><p class="note">Read-only durable attempts. Incomplete attempts preserve their reviewed manifest and require all current write-time guards before recovery.</p><p class="error" role="alert">Audit ${escapeHtml(label)}${error?`: ${escapeHtml(error)}`:"."}</p></section>`;
  }
  const rows=(attempts||[]).slice(0,25).map(attempt=>{const items=attempt.fantrax_sync_attempt_items||[],terminal=items.filter(item=>["APPLIED","SKIPPED"].includes(item.outcome)).length,recoverable=items.filter(item=>["PENDING","FAILED"].includes(item.outcome)).length;return `<tr><td>${escapeHtml(attempt.created_at||"")}</td><td>${escapeHtml(attempt.status||"")}</td><td>${escapeHtml(attempt.release_tier||"UNAVAILABLE")}</td><td>${escapeHtml(attempt.reviewed_count||0)} / ${escapeHtml(attempt.batch_limit||0)}</td><td>${escapeHtml(terminal)}</td><td>${escapeHtml(recoverable)}</td><td>${escapeHtml(String(attempt.manifest_digest||"").slice(0,12))}</td><td>${escapeHtml(attempt.id||"")}</td></tr>`}).join("");
  return `<section class="view-panel"><h2>Fantrax Synchronization Audit</h2><p class="note">Read-only durable attempts. Incomplete attempts preserve their reviewed manifest and require all current write-time guards before recovery.</p>${rows?`<div class="table-wrap"><table><thead><tr><th>Created</th><th>Status</th><th>Release</th><th>Reviewed / Cap</th><th>Terminal</th><th>Recoverable</th><th>Manifest</th><th>Attempt UUID</th></tr></thead><tbody>${rows}</tbody></table></div>`:"<p class='note'>0 durable synchronization attempts recorded for this league.</p>"}</section>`;
}
