import { EDITABLE_ROSTER_STATUSES, filterRosterStatusRows, pendingStatusFor, reviewGroups, statusSummary } from "../services/rosterStatusManagerService.js";
import { escapeHtml, optionHtml } from "../utils/dom.js";

const STATUS_LABELS={ACTIVE:"Active",RESERVE:"Reserve",IL:"IL",MINORS:"Minors",UNCLASSIFIED:"Unclassified"};
const STATUS_CLASS={ACTIVE:"good",RESERVE:"reserve",IL:"bad",MINORS:"minors",UNCLASSIFIED:"warn"};

function selected(value,current){return String(value)===String(current)?" selected":""}
function checked(value){return value?" checked":""}
function statusBadge(status){
  const safe=EDITABLE_ROSTER_STATUSES.includes(status)?status:"UNCLASSIFIED";
  return `<span class="status-badge ${STATUS_CLASS[safe]||"warn"}">${escapeHtml(STATUS_LABELS[safe]||safe)}</span>`;
}
function positions(row){return Array.isArray(row.positions)?row.positions.join("/"):""}
function ownerOptions(teams,current){
  return `<option value="">All owners</option><option value="FREE_AGENT"${selected("FREE_AGENT",current)}>Free agents</option>${teams.map(team=>optionHtml(team.id,team.name,current)).join("")}`;
}
function filterControls(state,filters,rows){
  const teams=state.teams||[];
  const positionsList=[...new Set(rows.flatMap(row=>Array.isArray(row.positions)?row.positions:[]).filter(Boolean))].sort();
  const mlbTeams=[...new Set(rows.map(row=>row.mlb_team).filter(Boolean))].sort();
  return `<div class="explorer-filters roster-status-filters">
    <label>Search<input id="rsmSearch" value="${escapeHtml(filters.search||"")}" placeholder="Player, owner, MLB team"></label>
    <label>Current Status<select id="rsmCurrentStatus"><option value="">All statuses</option>${EDITABLE_ROSTER_STATUSES.map(status=>optionHtml(status,STATUS_LABELS[status],filters.currentStatus)).join("")}</select></label>
    <label>Team<select id="rsmTeam">${ownerOptions(teams,filters.teamId||"")}</select></label>
    <label>Position<select id="rsmPosition"><option value="">All positions</option>${positionsList.map(pos=>optionHtml(pos,pos,filters.position)).join("")}</select></label>
    <label>MLB Team<select id="rsmMlbTeam"><option value="">All MLB teams</option>${mlbTeams.map(team=>optionHtml(team,team,filters.mlbTeam)).join("")}</select></label>
    <label>Owner<select id="rsmOwner">${ownerOptions(teams,filters.ownerId||"")}</select></label>
    <label>Free Agent<select id="rsmFreeAgent"><option value="">Any</option><option value="yes"${selected("yes",filters.freeAgent)}>Free agents</option><option value="no"${selected("no",filters.freeAgent)}>Rostered only</option></select></label>
    <label class="checkline"><input id="rsmChangedOnly" type="checkbox"${checked(filters.changedOnly)}> Show only changed rows</label>
    <button type="button" id="rsmApplyFilters" class="primary">Apply</button>
    <button type="button" id="rsmClearFilters" class="secondary">Clear Filters</button>
  </div>`;
}
function summaryCards(rows,pendingChanges,activeFilter){
  return `<div class="status-card-grid">${statusSummary(rows,pendingChanges).map(item=>`<button type="button" class="status-card ${STATUS_CLASS[item.status]||"warn"}${activeFilter===item.status?" active":""}" data-rsm-filter-status="${escapeHtml(item.status)}"><span>${escapeHtml(STATUS_LABELS[item.status])}</span><b>${item.count}</b></button>`).join("")}</div>`;
}
function statusSelect(row,pendingChanges){
  const value=pendingStatusFor(row,pendingChanges);
  return `<select data-rsm-status="${escapeHtml(row.id)}" aria-label="New status for ${escapeHtml(row.name||row.id)}">${EDITABLE_ROSTER_STATUSES.map(status=>optionHtml(status,STATUS_LABELS[status],value)).join("")}</select>`;
}
function playerTable(rows,state){
  const manager=state.rosterStatusManager||{},pendingChanges=manager.pendingChanges||{},selectedIds=manager.selectedIds||[];
  const selected=new Set(selectedIds);
  return `<div class="table-wrap roster-status-table"><table><thead><tr>
    <th><input type="checkbox" id="rsmSelectPage" aria-label="Select page"${rows.length&&rows.every(row=>selected.has(row.id))?" checked":""}></th>
    <th>Player Name</th><th>Owner</th><th>Position</th><th>MLB Team</th><th>Current Status</th><th>New Status</th><th>Source</th><th>Last Updated</th><th>Validation</th>
  </tr></thead><tbody>${rows.length?rows.map(row=>{
    const changed=Boolean(pendingChanges[row.id]);
    return `<tr class="${changed?"pending-row":""}">
      <td><input type="checkbox" data-rsm-select="${escapeHtml(row.id)}"${selected.has(row.id)?" checked":""} aria-label="Select ${escapeHtml(row.name||row.id)}"></td>
      <td>${escapeHtml(row.name||"Unavailable")}</td>
      <td>${escapeHtml(row.ownerName||"Free Agent")}</td>
      <td>${escapeHtml(positions(row)||"Unavailable")}</td>
      <td>${escapeHtml(row.mlb_team||"Unavailable")}</td>
      <td>${statusBadge(row.currentStatus)}</td>
      <td>${statusSelect(row,pendingChanges)}</td>
      <td>${escapeHtml(row.source||"Cloud")}</td>
      <td>${escapeHtml(row.updated_at||"Unavailable")}</td>
      <td>${escapeHtml(changed?`${row.currentStatus} -> ${pendingChanges[row.id].newStatus}`:row.validation||"Valid")}</td>
    </tr>`;
  }).join(""):`<tr><td colspan="10" class="note">No rows found.</td></tr>`}</tbody></table></div>`;
}
function pageControls(manager,filteredCount,pageRows){
  const page=manager.page||1,pageSize=manager.pageSize||100;
  const from=filteredCount?((page-1)*pageSize)+1:0;
  const to=Math.min(filteredCount,page*pageSize);
  return `<div class="toolbar"><span class="pill">Showing ${from}-${to} of ${filteredCount}</span><label>Page size<select id="rsmPageSize"><option${pageSize===50?" selected":""}>50</option><option${pageSize===100?" selected":""}>100</option><option${pageSize===250?" selected":""}>250</option></select></label><button type="button" id="rsmPrevPage" class="secondary"${page<=1?" disabled":""}>Previous</button><button type="button" id="rsmNextPage" class="secondary"${to>=filteredCount?" disabled":""}>Next</button></div>`;
}
function bulkToolbar(selectedCount){
  if(!selectedCount)return "";
  return `<div class="toolbar sticky-action-bar" aria-live="polite"><b>${selectedCount} players selected</b>${EDITABLE_ROSTER_STATUSES.map(status=>`<button type="button" class="secondary" data-rsm-bulk-status="${escapeHtml(status)}">Set ${escapeHtml(STATUS_LABELS[status])}</button>`).join("")}<button type="button" id="rsmClearPendingSelected" class="secondary">Clear Pending Changes</button></div>`;
}
function reviewPanel(pendingChanges){
  const groups=reviewGroups(pendingChanges);
  const total=Object.keys(pendingChanges).length;
  return `<aside class="review-panel"><h3>Pending Changes</h3><p class="note">${total} pending roster status updates. Ownership, identity, and free-agent flags are not part of this workflow.</p>${groups.length?groups.map(group=>`<section><h3>Move to ${escapeHtml(STATUS_LABELS[group.status])}</h3><p class="note">${group.rows.length} players</p><ul>${group.rows.map(row=>`<li><b>${escapeHtml(row.playerName||row.playerId)}</b><span>${escapeHtml(row.currentStatus)} &darr; ${escapeHtml(row.newStatus)}</span></li>`).join("")}</ul></section>`).join(""):"<p class='note'>No pending changes.</p>"}<div class="toolbar"><button type="button" id="rsmSaveChanges" class="primary"${total?"":" disabled"}>Save Changes</button><button type="button" id="rsmCancelChanges" class="secondary"${total?"":" disabled"}>Cancel Changes</button></div></aside>`;
}
function confirmationPanel(pendingChanges,visible){
  const total=Object.keys(pendingChanges).length;
  if(!visible||!total)return "";
  return `<section class="panel confirm-panel" role="dialog" aria-label="Confirm roster status updates"><h3>Apply ${total} roster status updates?</h3><p class="note">Statuses only will be changed.</p><p class="note">Ownership will not change. Fantrax identity will not change. Player UUIDs, MLBAM IDs, and free-agent state will not change.</p><div class="toolbar"><button type="button" id="rsmConfirmSave" class="primary">Proceed</button><button type="button" id="rsmDismissConfirm" class="secondary">Keep Editing</button></div></section>`;
}
export function renderRosterStatusManager(state){
  const manager=state.rosterStatusManager||{};
  const rows=manager.rows||[];
  const filters=manager.filters||{};
  const pendingChanges=manager.pendingChanges||{};
  const filtered=filterRosterStatusRows(rows,filters,pendingChanges);
  const page=manager.page||1,pageSize=manager.pageSize||100;
  const pageRows=filtered.slice((page-1)*pageSize,page*pageSize);
  const selectedCount=(manager.selectedIds||[]).length;
  const changedCount=Object.keys(pendingChanges).length;
  return `<section class="view-panel roster-status-manager"><h2>Roster Status Manager</h2><p class="note">Manual review for roster-status corrections. Pending edits stay in the browser until Save Changes is confirmed.</p>${summaryCards(rows,pendingChanges,filters.currentStatus)}${filterControls(state,filters,rows)}<div class="toolbar"><button type="button" id="rsmSelectAllFiltered" class="secondary">Select all filtered</button><button type="button" id="rsmClearSelection" class="secondary">Clear selection</button><span class="pill">${selectedCount} players selected</span><span class="pill warn">${changedCount} pending changes</span>${manager.saving?`<span class="pill">Saving...</span>`:""}${manager.error?`<span class="pill bad">${escapeHtml(manager.error)}</span>`:""}${manager.lastSavedAt?`<span class="pill good">Last saved ${escapeHtml(manager.lastSavedAt)}</span>`:""}</div>${confirmationPanel(pendingChanges,manager.confirmSave)}${bulkToolbar(selectedCount)}${pageControls(manager,filtered.length,pageRows)}<div class="roster-status-layout">${playerTable(pageRows,state)}${reviewPanel(pendingChanges)}</div></section>`;
}
