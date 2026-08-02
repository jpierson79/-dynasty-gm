import * as cloudMigration from "./cloudMigrationService.js";
import * as cloudCsvImport from "./cloudCsvImportService.js";

const migrationState={
  leagues:[],
  selectedLeague:null,
  cloudCounts:null,
  preview:null,
  running:false,
  cancelRequested:false,
  lastResult:null,
  verification:null
};
const importState={
  running:false,
  cancelRequested:false,
  lastStep:null,
  lastResult:null,
  verification:null,
  previews:{},
  previewFiles:{},
  stages:{
    fantrax:"Not started",
    hkb:"Not started",
    statcastHitters:"Not started",
    statcastPitchers:"Not started",
    trades:"Not started",
    custom:"Not started",
    verification:"Not started"
  }
};
const cloudRuntimeState={
  loading:false,
  loadedLeagueId:null
};
const dataMode={
  mode:"local",
  authenticated:false,
  leagueId:null,
  leagueName:null,
  cloudAvailable:false,
  message:"Local mode"
};
const diagnosticState={
  kind:null,
  page:1,
  pageSize:100,
  search:"",
  filters:{},
  data:null,
  loading:false
};
const importExceptionState={
  step:null,
  summary:null,
  details:[]
};

const state={
  service:null,
  session:null,
  profile:null,
  status:"library-loading",
  message:"Library loading",
  loading:false,
  localOnly:false,
  clientReady:false,
  signupHandlerRegistered:false
};

function $(id){return document.getElementById(id)}
function clean(value){return String(value??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]))}
function isFileProtocol(){return window.location.protocol==="file:"}

function statusLabel(){
  const labels={
    "library-loading":"Library loading",
    "client-initialized":"Client initialized",
    "session-loading":"Session loading",
    "signed-out":"Signed out",
    "signed-in":"Signed in",
    "library-load-failed":"Library load failed",
    "config-missing":"Configuration missing",
    "network-timeout":"Network timeout",
    "network-error":"Network error",
    "signup-failed":"Signup failed",
    "account-created":"Account created",
    confirmation:"Check your email"
  };
  if(labels[state.status])return labels[state.status];
  if(state.localOnly)return"Local-only mode";
  return"Signed out";
}

function statusClass(){
  if(dataMode.mode==="cloud")return"good";
  if(dataMode.mode==="offline")return"bad";
  if(dataMode.authenticated&&!dataMode.leagueId)return"warn";
  if(["signed-in","account-created","client-initialized"].includes(state.status))return"good";
  if(["library-loading","session-loading","signed-out","confirmation"].includes(state.status)||state.localOnly)return"warn";
  return"bad";
}

function displayName(){
  return state.profile?.display_name||
    state.profile?.displayName||
    state.session?.user?.user_metadata?.display_name||
    "";
}

function email(){
  return state.session?.user?.email||"";
}

function setStatus(status,message,isError=false){
  state.status=status;
  state.message=message||statusLabel();
  setMessage(state.message,isError);
  renderAuthView();
}

function setDataMode(patch={}){
  Object.assign(dataMode,patch);
  dataMode.authenticated=Boolean(state.session);
}

function cloudModeLabel(){
  if(dataMode.mode==="cloud")return dataMode.leagueName?`Cloud · ${dataMode.leagueName}`:"Cloud mode";
  if(dataMode.mode==="offline")return"Cloud unavailable · Local fallback";
  if(dataMode.authenticated&&!dataMode.leagueId)return"Cloud connected · Select league";
  return"Local mode";
}

function setMessage(text,isError=false){
  state.message=text||"";
  const el=$("authMessage");
  if(el){
    el.textContent=state.message;
    el.className=`note mt-10 ${isError?"auth-error":"auth-success"}`;
  }
}

function authButtonsDisabled(){
  return state.loading||!state.clientReady||["config-missing","network-timeout","network-error","library-load-failed"].includes(state.status);
}

function renderCloudStatus(){
  const label=statusLabel();
  const cls=statusClass();
  const provider=dataMode.mode==="cloud"?"Supabase Cloud":dataMode.mode==="offline"?"Local fallback":"Browser Local Storage";
  const modeLabel=cloudModeLabel();
  const header=$("cloudStatusIndicator");
  if(header){
    header.className=`cloud-status pill ${cls}`;
    header.textContent=modeLabel;
    header.title=`Current data provider: ${provider}`;
  }
  const authStatus=$("authCloudStatus");
  if(authStatus){
    authStatus.innerHTML=`<div class="debug-grid"><div><span>Authentication</span><b>${clean(state.session?`Signed in as ${email()}`:label)}</b></div><div><span>Cloud connection</span><b>${clean(dataMode.mode==="offline"?"Unavailable":state.clientReady?"Connected":"Not connected")}</b></div><div><span>Active league</span><b>${clean(dataMode.leagueName||"Select league")}</b></div><div><span>Data source</span><b>${clean(provider)}</b></div><div><span>Local storage</span><b>Active league ID and UI preferences only</b></div></div>`;
  }
}

function renderAuthView(){
  renderCloudStatus();
  const signedIn=Boolean(state.session);
  $("authSignedInPanel")?.classList.toggle("hidden",!signedIn);
  $("authForms")?.classList.toggle("hidden",signedIn);
  const who=$("authSignedInUser");
  if(who)who.innerHTML=signedIn?`Signed in as <b>${clean(displayName()||email())}</b>${displayName()&&email()?` <span class="note">(${clean(email())})</span>`:""}`:"";
  const disabled=authButtonsDisabled();
  const signInButton=$("authSignInButton");
  const signUpButton=$("authSignUpButton");
  const signOutButton=$("authSignOutButton");
  const retryButton=$("authRetryButton");
  if(signInButton)signInButton.disabled=disabled;
  if(signUpButton){
    signUpButton.disabled=disabled;
    signUpButton.textContent=state.loading?"Working...":"Create Account";
  }
  if(signOutButton)signOutButton.disabled=state.loading||!state.clientReady;
  if(retryButton)retryButton.disabled=state.loading||isFileProtocol();
  const localOnly=$("authLocalOnlyNote");
  if(localOnly){
    localOnly.textContent=state.status==="config-missing"?"Supabase configuration is missing. The app is running from this browser only.":
      state.status==="library-load-failed"?"Supabase library failed to load. Local-only mode is still available.":
      state.status==="network-timeout"?"Supabase connection timed out. Local-only mode is still available.":
      state.status==="network-error"?"Supabase could not be reached. The app is running from this browser only.":
      state.localOnly?"Local-only mode is active for this browser session.":
      "Local fallback remains available for startup and UI preferences.";
  }
  const message=$("authMessage");
  if(message&&state.loading)message.textContent=state.message||statusLabel();
  else if(message&&!message.textContent)message.textContent=state.message;
  renderCloudMigration();
}

function countGridHTML(items){
  return `<div class="debug-grid">${items.map(([label,value])=>`<div><span>${clean(label)}</span><b>${clean(value)}</b></div>`).join("")}</div>`;
}

const importSteps=["fantrax","hkb","statcastHitters","statcastPitchers","trades","custom","verification"];
const importLabels={
  fantrax:"Fantrax player pool and roster",
  hkb:"HarryKnowsBall values",
  statcastHitters:"Statcast hitters",
  statcastPitchers:"Statcast pitchers",
  trades:"Fantrax trade history",
  custom:"Manager Intelligence",
  verification:"Verification"
};
const confirmIds={fantrax:"cloudConfirmFantrax",hkb:"cloudConfirmHkb",statcastHitters:"cloudConfirmStatcastHitters",statcastPitchers:"cloudConfirmStatcastPitchers",trades:"cloudConfirmTrades",custom:"cloudConfirmCustom"};
const previewButtonIds={fantrax:"cloudPreviewFantraxButton",hkb:"cloudPreviewHkbButton",statcastHitters:"cloudPreviewStatcastHittersButton",statcastPitchers:"cloudPreviewStatcastPitchersButton",trades:"cloudPreviewTradesButton",custom:"cloudPreviewCustomButton"};
const importButtonIds={fantrax:"cloudImportFantraxButton",hkb:"cloudImportHkbButton",statcastHitters:"cloudImportStatcastHittersButton",statcastPitchers:"cloudImportStatcastPitchersButton",trades:"cloudImportTradesButton",custom:"cloudImportCustomButton"};
const fileInputIds={fantrax:"cloudFantraxFile",hkb:"cloudHkbFile",statcastHitters:"cloudStatcastHittersFile",statcastPitchers:"cloudStatcastPitchersFile",trades:"cloudTradesFile",custom:"cloudCustomFile"};

function priorRequiredComplete(step){
  return true;
}

function renderImportStageSummary(){
  const el=$("cloudImportStageSummary");
  if(!el)return;
  el.innerHTML=`<table><thead><tr><th>Stage</th><th>Status</th></tr></thead><tbody>${importSteps.map(step=>`<tr><td>${clean(importLabels[step])}</td><td>${clean(importState.stages[step]||"Not started")}</td></tr>`).join("")}</tbody></table>`;
}

function renderActivationStatus(){
  const header=$("cloudStatusIndicator");
  if(header&&state.session)renderCloudStatus();
  const msg=$("cloudActivationMessage");
  if(msg){
    msg.textContent=dataMode.mode==="cloud"?"Supabase Cloud is the active data source. Empty leagues are valid and ready for imports.":
      dataMode.mode==="offline"?"Cloud is temporarily unavailable. Local fallback is active and cloud data was not overwritten.":
      dataMode.authenticated?"Select or create a cloud league to use Supabase Cloud.":"Sign in to use Supabase Cloud.";
  }
  const recalc=$("cloudRecalculateScoresButton");
  if(recalc)recalc.disabled=dataMode.mode!=="cloud";
}

function renderCloudMigration(){
  const summary=$("cloudMigrationSummary");
  if(!summary)return;
  renderImportStageSummary();
  renderActivationStatus();
  const league=migrationState.selectedLeague;
  const counts=migrationState.cloudCounts||{};
  const leagues=migrationState.leagues||[];
  const leagueSelect=$("cloudLeagueSelect");
  if(leagueSelect){
    leagueSelect.innerHTML=`<option value="">No cloud league selected</option>${leagues.map(item=>`<option value="${clean(item.id)}">${clean(item.name||"Unnamed League")}</option>`).join("")}`;
    leagueSelect.value=league?.id||"";
  }
  summary.innerHTML=countGridHTML([
    ["Signed-in user",displayName()||email()||"None"],
    ["Current cloud league",league?.name||"None selected"],
    ["Available leagues",leagues.length],
    ["Cloud players",counts.players||0],
    ["Cloud managers",counts.managers||0],
    ["Cloud teams",counts.teams||0],
    ["Cloud trades",counts.trades||0],
    ["Player metrics",counts.player_metrics||0],
    ["Calculated scores",counts.calculated_player_scores||0],
    ["Trade assets",counts.trade_assets||0],
    ["Active data source",dataMode.mode==="cloud"?"Supabase Cloud":dataMode.mode==="offline"?"Local fallback":"Select league"]
  ]);
  const canUseCloud=state.clientReady&&Boolean(state.session);
  const isSelectedLeagueOwner=Boolean(league&&state.session?.user?.id&&league.owner_user_id===state.session.user.id);
  const createButton=$("cloudCreateLeagueButton"),refreshButton=$("cloudRefreshLeaguesButton");
  if(createButton)createButton.disabled=!canUseCloud;
  if(refreshButton)refreshButton.disabled=!canUseCloud||state.loading;
  const resetPreview=$("cloudResetPreviewButton"),resetRun=$("cloudResetRunButton");
  if(resetPreview)resetPreview.disabled=!canUseCloud||!league||!isSelectedLeagueOwner||state.loading;
  if(resetRun)resetRun.disabled=resetRun.disabled||!canUseCloud||!league||!isSelectedLeagueOwner||state.loading;
  const resetResult=$("cloudResetResult");
  if(resetResult&&!isSelectedLeagueOwner&&league)resetResult.innerHTML="<p class='note'>Cloud data reset is available only to the selected league owner.</p>";
  if(leagueSelect)leagueSelect.disabled=!canUseCloud||state.loading||!leagues.length;
  Object.entries(previewButtonIds).forEach(([step,id])=>{const button=$(id);if(button)button.disabled=!canUseCloud||!league||importState.running||!priorRequiredComplete(step)});
  Object.entries(importButtonIds).forEach(([step,id])=>{
    const button=$(id);
    const file=fileForStep(step);
    const previewedFile=!file||!importState.previewFiles[step]||importState.previewFiles[step]===file;
    const teamConfirmed=step!=="fantrax"||$("cloudConfirmFantraxTeams")?.checked;
    if(button)button.disabled=!canUseCloud||!league||importState.running||!priorRequiredComplete(step)||!importState.previews[step]||!previewedFile||!$(confirmIds[step])?.checked||!teamConfirmed||importState.previews[step]?.blockingErrors?.length;
  });
  const verifyButton=$("cloudVerifyButton");
  if(verifyButton)verifyButton.disabled=!canUseCloud||!league||importState.running||!priorRequiredComplete("verification");
  const cancelImport=$("cloudCancelImportButton"),retryImport=$("cloudRetryImportButton");
  if(cancelImport)cancelImport.disabled=!importState.running;
  if(retryImport)retryImport.disabled=!importState.lastStep||importState.running;
}

function renderImportProgress(payload){
  const el=$("cloudImportProgress");
  if(!el)return;
  if(payload?.checks){
    const counts=payload.counts||{};
    el.innerHTML=`<h3>Cloud Import Verification</h3>${countGridHTML([["Teams",counts.teams||0],["Managers",counts.managers||0],["Players",counts.players||0],["Player metrics",counts.player_metrics||0],["Calculated scores",counts.calculated_player_scores||0],["Trades",counts.trades||0],["Trade assets",counts.trade_assets||0],["Snapshots",counts.player_snapshots||0]])}<table class="mt-12"><thead><tr><th>Check</th><th>Status</th><th>Detail</th><th>Diagnostics</th></tr></thead><tbody>${payload.checks.map(check=>`<tr><td>${clean(check.name)}</td><td>${clean(check.status)}</td><td>${clean(check.detail)}</td><td>${check.diagnosticKey&&Number(check.diagnosticCount)>0?`<button type="button" class="secondary cloud-diagnostic-button" data-diagnostic="${clean(check.diagnosticKey)}">View Details</button>`:""}</td></tr>`).join("")}</tbody></table>`;
    return;
  }
  const details=Array.isArray(payload?.exceptionDetails)?payload.exceptionDetails:[];
  const summary={
    matched:payload?.matched??payload?.matchedRecords??0,
    inserted:payload?.inserted??0,
    updated:payload?.updated??0,
    skipped:payload?.skipped??payload?.unmatched??0,
    warnings:payload?.warnings??details.length??0,
    errors:payload?.errors??(payload?.error?1:0)
  };
  if(payload?.step)importExceptionState.step=payload.step;
  importExceptionState.summary=summary;
  importExceptionState.details=details;
  const viewDetails=summary.warnings>0?`<button type="button" class="secondary" data-import-exceptions="view">View Details</button>`:"";
  const exportButton=summary.warnings>0?`<button type="button" class="secondary" data-import-exceptions="export">Export Warnings CSV</button>`:"";
  el.innerHTML=`<div class="debug-grid"><div><span>Stage</span><b>${clean(payload?.stage||"Not started")}</b></div><div><span>Processed</span><b>${clean(payload?.processed??0)} / ${clean(payload?.total??0)}</b></div><div><span>Matched</span><b>${clean(summary.matched)}</b></div><div><span>Inserted</span><b>${clean(summary.inserted)}</b></div><div><span>Updated</span><b>${clean(summary.updated)}</b></div><div><span>Skipped</span><b>${clean(summary.skipped)}</b></div><div><span>Warnings</span><b>${clean(summary.warnings)}</b></div><div><span>Errors</span><b>${clean(summary.errors)}</b></div></div><p class="note mt-10">${clean(payload?.message||"")}</p><div class="auth-actions mt-10">${viewDetails}${exportButton}</div><div id="cloudImportExceptionDetails" class="mt-12"></div>`;
}

function importExceptionRows(){
  return (importExceptionState.details||[]).map(row=>({
    csvRow:row.csvRow??row.sourceRowNumber??"",
    playerName:row.playerName??row.name??row.incomingPlayerName??"",
    fantraxId:row.fantraxId??row.fantrax_id??row.incomingFantraxId??"",
    mlbamId:row.mlbamId??row.mlbam_id??row.incomingMlbamId??"",
    team:row.team??row.owner??"",
    actionAttempted:row.actionAttempted??row.action??"",
    failureReason:row.failureReason??row.reason??"",
    suggestedResolution:row.suggestedResolution??"Review the source row, confirm stable IDs and names, then preview/import again."
  }));
}

function renderImportExceptionDetails(){
  const out=$("cloudImportExceptionDetails");
  if(!out)return;
  const rows=importExceptionRows();
  out.innerHTML=rows.length?`<h3>Import Exception Viewer</h3><table><thead><tr><th>CSV row</th><th>Player name</th><th>Fantrax ID</th><th>MLBAM ID</th><th>Team</th><th>Import action attempted</th><th>Failure reason</th><th>Suggested resolution</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${clean(row.csvRow)}</td><td>${clean(row.playerName)}</td><td>${clean(row.fantraxId)}</td><td>${clean(row.mlbamId)}</td><td>${clean(row.team)}</td><td>${clean(row.actionAttempted)}</td><td>${clean(row.failureReason)}</td><td>${clean(row.suggestedResolution)}</td></tr>`).join("")}</tbody></table>`:"<p class='note'>No import warnings to display.</p>";
}

function exportImportWarnings(){
  const rows=importExceptionRows();
  if(!rows.length){setMessage("No import warnings to export.",false);return}
  downloadCsv(`cloud-import-warnings-${importExceptionState.step||"import"}.csv`,rows,[
    {label:"CSV row",value:"csvRow"},
    {label:"Player name",value:"playerName"},
    {label:"Fantrax ID",value:"fantraxId"},
    {label:"MLBAM ID",value:"mlbamId"},
    {label:"Team",value:"team"},
    {label:"Import action attempted",value:"actionAttempted"},
    {label:"Failure reason",value:"failureReason"},
    {label:"Suggested resolution",value:"suggestedResolution"}
  ]);
}

function renderImportPreview(step,preview){
  const el=$("cloudImportPreview");
  if(!el)return;
  const errors=preview.blockingErrors?.length?`<h3>Blocking Errors</h3><ul class="edge-reasons">${preview.blockingErrors.map(x=>`<li>${clean(x)}</li>`).join("")}</ul>`:"<p class='note'>No blocking errors detected.</p>";
  const warnings=preview.warnings?.length?`<h3>Warnings</h3><ul class="edge-reasons">${preview.warnings.map(x=>`<li>${clean(x)}</li>`).join("")}</ul>`:"";
  const columns=(preview.columns||[]).slice(0,30).map(clean).join(", ");
  const categories=preview.categories?`<details class="mt-10"><summary><b>Inspect Manager Intelligence Categories</b></summary><table><thead><tr><th>Category</th><th>Records</th></tr></thead><tbody>${Object.entries(preview.categories).map(([key,value])=>`<tr><td>${clean(key)}</td><td>${clean(value)}</td></tr>`).join("")}</tbody></table></details>`:"";
  const fantraxCounts=preview.previewSchema==="fantrax-identity-v2"?[
    ["Parsed rows",preview.parsedRows??preview.totalRows??0],
    ["Valid rows",preview.validRows??0],
    ["Invalid rows",preview.invalidRows??0],
    ["Duplicate source rows",preview.duplicateSourceRows??preview.duplicateRows??0],
    ["Rows after deduplication",preview.validRowsAfterDeduplication??preview.sourceRowsAfterDeduplication??0],
    ["Existing cloud matches",preview.existingCloudMatches??0],
    ["New players to insert",preview.newPlayersToInsert??0],
    ["Identity conflicts",preview.identityConflicts??0],
    ["Unmatched",preview.unmatchedRows??0],
    ["Rows with Fantrax IDs",preview.rowsWithFantraxIds??0],
    ["Rows with MLBAM IDs",preview.rowsWithMlbamIds??0],
    ["Name-only rows",preview.nameOnlyRows??0],
    ["Ownership column",preview.ownershipColumnDetected||"None"],
    ["Roster-slot column",preview.rosterSlotColumnDetected||"None"],
    ["Fantasy teams detected",(preview.fantasyTeamsDetected||[]).length],
    ["Non-team status tokens",(preview.nonTeamStatusTokensDetected||[]).length],
    ["Free agents detected",preview.freeAgentsDetected??0],
    ["Rostered players detected",preview.rosteredPlayersDetected??0],
    ["Cloud players loaded",preview.cloudPlayersLoaded??0],
    ["Matching against",preview.matchingAgainst||preview.previewPlayerCollectionSource||"Cloud players"],
    ["Supabase project",preview.supabaseProjectHost||"Unknown"],
    ["Selected league",preview.selectedLeagueId||"None"],
    ["Unique matched UUIDs",preview.updateResolutionDiagnostics?.uniqueMatchedPlayerUuids??0],
    ["Largest UUID group",preview.updateResolutionDiagnostics?.largestResolvedUuidGroupSize??0],
    ["Estimated batches",preview.estimatedBatches??0],
    ["Status",preview.blockingErrors?.length?"Failed":"Preview ready"]
  ]:[
    ["File",preview.fileName||"None"],
    ["Detected source",preview.sourceType||"Unknown"],
    ["Total rows",preview.totalRows??0],
    ["Valid rows",preview.validRows??0],
    ["Invalid rows",preview.invalidRows??0],
    ["Duplicate rows",preview.duplicateRows??0],
    ["Matched records",preview.matchedRecords??0],
    ["Unmatched records",preview.unmatchedRecords??0],
    ["Estimated batches",preview.estimatedBatches??0],
    ["Status",preview.blockingErrors?.length?"Failed":"Preview ready"]
  ];
  const duplicateGroups=preview.previewSchema==="fantrax-identity-v2"&&preview.updateResolutionDiagnostics?.duplicateResolvedUuidGroups?.length
    ?`<details class="mt-10"><summary><b>Duplicate Matched UUID Groups</b></summary><table><thead><tr><th>Player UUID</th><th>Rows</th><th>Safe collapse</th></tr></thead><tbody>${preview.updateResolutionDiagnostics.duplicateResolvedUuidGroups.map(group=>`<tr><td>${clean(group.internalPlayerId)}</td><td>${clean(group.count)}</td><td>${group.safeToCollapse?"Yes":"No"}</td></tr>`).join("")}</tbody></table></details>`
    :"";
  const fantraxTokens=preview.previewSchema==="fantrax-identity-v2"?`<div class="two mt-12"><div><h3>Detected Fantasy Teams</h3><p class="note">${(preview.fantasyTeamsDetected||[]).map(clean).join(", ")||"None detected"}</p></div><div><h3>Non-Team Status Tokens</h3><p class="note">${(preview.nonTeamStatusTokensDetected||[]).map(clean).join(", ")||"None detected"}</p></div></div>`:"";
  const rosterDiagnostics=preview.previewSchema==="fantrax-identity-v2"?`<details class="mt-10" open><summary><b>Roster Slot Normalization</b></summary><div class="two mt-10"><div><h3>Distinct Raw Roster Tokens</h3><p class="note">${(preview.distinctRawRosterTokens||[]).map(clean).join(", ")||"None detected"}</p></div><div><h3>Unknown Tokens</h3><p class="note">${(preview.unknownRosterTokens||[]).map(clean).join(", ")||"None detected"}</p></div></div>${countGridHTML(Object.entries(preview.normalizedRosterStatusCounts||{}))}${preview.first25UnclassifiedExamples?.length?`<h3>First 25 Unclassified Examples</h3><table><thead><tr><th>CSV row</th><th>Player</th><th>Roster slot</th><th>Ownership</th></tr></thead><tbody>${preview.first25UnclassifiedExamples.map(row=>`<tr><td>${clean(row.csvRow)}</td><td>${clean(row.playerName)}</td><td>${clean(row.rawRosterSlot)}</td><td>${clean(row.ownershipToken)}</td></tr>`).join("")}</tbody></table>`:""}</details>`:"";
  const statcastIdentity=preview.statcastIdentitySummary?`<details class="mt-10" open><summary><b>Statcast Identity and MLBAM Backfill</b></summary>${countGridHTML([["Matched by MLBAM",preview.statcastIdentitySummary.matchedByMlbam||0],["Matched by Fantrax ID",preview.statcastIdentitySummary.matchedByFantrax||0],["Matched by unambiguous name",preview.statcastIdentitySummary.matchedByUnambiguousName||0],["MLBAM backfillable",preview.statcastIdentitySummary.mlbamBackfillable||0],["MLBAM already present",preview.statcastIdentitySummary.mlbamAlreadyPresent||0],["MLBAM conflicts",preview.statcastIdentitySummary.mlbamConflicts||0],["Ambiguous",preview.statcastIdentitySummary.ambiguous||0],["Unmatched",preview.statcastIdentitySummary.unmatched||0],["Invalid player_id values",preview.statcastIdentitySummary.invalidPlayerIds||0]])}</details>`:"";
  const hkbDiagnostics=preview.previewSchema==="hkb-matching-v1"?`<details class="mt-10" open><summary><b>HKB Matching Diagnostics</b></summary>${countGridHTML([["Source rows",preview.hkbSummary?.totalSourceRows||0],["Player rows",preview.hkbSummary?.playerRows||0],["Non-player assets",preview.hkbSummary?.nonPlayerAssets||0],["Unique name matches",preview.hkbSummary?.uniqueNormalizedNameMatches||0],["Normalization repairs",preview.hkbSummary?.normalizationMismatches||0],["Contextual matches",preview.hkbSummary?.contextualMatches||0],["Ambiguous",preview.hkbSummary?.ambiguousRows||0],["Context conflicts",preview.hkbSummary?.contextConflicts||0],["Absent from cloud",preview.hkbSummary?.playersAbsentFromCloud||0],["Invalid",preview.hkbSummary?.invalidRows||0],["Cloud players loaded",preview.cloudPlayersLoaded||0]])}${preview.hkbDiagnostics?.length?`<table><thead><tr><th>Row</th><th>Name</th><th>Team</th><th>Position</th><th>Level</th><th>Category</th><th>Candidates</th><th>Suggested resolution</th></tr></thead><tbody>${preview.hkbDiagnostics.map(row=>`<tr><td>${clean(row.csvRow)}</td><td>${clean(row.playerName)}</td><td>${clean(row.team)}</td><td>${clean(row.sourcePosition)}</td><td>${clean(row.sourceLevel)}</td><td>${clean(row.diagnosticCategory)}</td><td>${clean(row.candidateDetails||"None")}</td><td>${clean(row.suggestedResolution)}</td></tr>`).join("")}</tbody></table>`:"<p class='note'>No HKB diagnostic rows.</p>"}</details>`:"";
  const ambiguous=preview.previewSchema==="fantrax-identity-v2"&&preview.first50AmbiguousOrMalformed?.length?`<details class="mt-10"><summary><b>First ambiguous or malformed records</b></summary><table><thead><tr><th>Row</th><th>Name</th><th>Fantrax</th><th>MLBAM</th><th>Reason</th></tr></thead><tbody>${preview.first50AmbiguousOrMalformed.map(row=>`<tr><td>${clean(row.sourceRowNumber||"")}</td><td>${clean(row.incomingPlayerName||row.name||"")}</td><td>${clean(row.incomingFantraxId||row.fantrax_id||"")}</td><td>${clean(row.incomingMlbamId||row.mlbam_id||"")}</td><td>${clean(row.reason||"")}</td></tr>`).join("")}</tbody></table></details>`:"";
  el.innerHTML=`<h3>${clean(importLabels[step])} Preview</h3>${countGridHTML(fantraxCounts)}<p class="note mt-10"><b>Detected columns:</b> ${columns||"JSON file"}</p>${fantraxTokens}${rosterDiagnostics}${statcastIdentity}${hkbDiagnostics}${errors}${warnings}${categories}${duplicateGroups}${ambiguous}`;
}

function diagnosticPanel(){
  return $("cloudMigrationVerification")||$("cloudImportProgress");
}

function csvCell(value){
  const text=String(value??"");
  return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}

function downloadCsv(fileName,rows,headers){
  const csv=[headers.map(h=>csvCell(h.label)).join(","),...rows.map(row=>headers.map(h=>csvCell(typeof h.value==="function"?h.value(row):row[h.value])).join(","))].join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function freeAgentHeaders(){
  return [
    {label:"Player name",value:"name"},
    {label:"players.id",value:"id"},
    {label:"fantrax_id",value:"fantrax_id"},
    {label:"mlbam_id",value:"mlbam_id"},
    {label:"normalized_name",value:"normalized_name"},
    {label:"position",value:"position"},
    {label:"MLB organization",value:"mlb_team"},
    {label:"imported Fantrax status",value:"roster_status"},
    {label:"roster status",value:"roster_status"},
    {label:"owner_team_id",value:"owner_team_id"},
    {label:"resolved fantasy team name",value:"resolved_team_name"},
    {label:"latest import source",value:"latest_import_source"},
    {label:"updated_at",value:"updated_at"},
    {label:"diagnostic reason",value:"diagnostic_reason"}
  ];
}

function duplicateHeaders(){
  return [
    {label:"normalized_name",value:"normalized_name"},
    {label:"classification",value:"duplicate_classification"},
    {label:"group size",value:"duplicate_group_size"},
    {label:"Player name",value:"name"},
    {label:"players.id",value:"id"},
    {label:"fantrax_id",value:"fantrax_id"},
    {label:"mlbam_id",value:"mlbam_id"},
    {label:"position",value:"position"},
    {label:"organization",value:"mlb_team"},
    {label:"age",value:"age"},
    {label:"owner/team",value:"resolved_team_name"},
    {label:"roster status",value:"roster_status"},
    {label:"created_at",value:"created_at"},
    {label:"updated_at",value:"updated_at"}
  ];
}

function optionList(items,valueKey,labelKey,current){
  return `<option value="">All</option>${(items||[]).map(item=>{
    const value=typeof item==="string"?item:item[valueKey];
    const label=typeof item==="string"?item:item[labelKey];
    return `<option value="${clean(value)}" ${String(current||"")===String(value)?"selected":""}>${clean(label||value)}</option>`;
  }).join("")}`;
}

function diagnosticSummaryHTML(data){
  const s=data?.summary||{};
  if(data?.kind==="freeAgentOwnership")return countGridHTML([
    ["Free-Agent Ownership Conflicts",s.totalConflicts||0],
    ["Likely stale ownership",s.likelyStaleOwnership||0],
    ["Likely status-mapping errors",s.likelyStatusMappingErrors||0],
    ["Unknown",s.unknown||0]
  ]);
  return countGridHTML([
    ["Normalized Name Duplicates",s.totalDuplicateNames||0],
    ["Affected player records",s.totalAffectedPlayerRecords||0],
    ["Distinct authoritative IDs",s.groupsWithDistinctAuthoritativeIds||0],
    ["Missing authoritative IDs",s.groupsMissingAuthoritativeIds||0],
    ["Potential true duplicates",s.potentialTrueDuplicatesRequiringReview||0]
  ]);
}

function freeAgentFiltersHTML(data){
  const f=diagnosticState.filters||{}, lists=data?.filters||{};
  return `<div class="formgrid mt-12"><div><label>Search player</label><input id="diagSearch" value="${clean(diagnosticState.search)}" placeholder="Player name"></div><div><label>Fantrax status</label><select id="diagFantraxStatus">${optionList(lists.fantraxStatuses,"","",f.fantraxStatus)}</select></div><div><label>Fantasy team</label><select id="diagFantasyTeam">${optionList(lists.fantasyTeams,"id","name",f.fantasyTeam)}</select></div><div><label>Roster status</label><select id="diagRosterStatus">${optionList(lists.rosterStatuses,"","",f.rosterStatus)}</select></div><div><label>Has Fantrax ID</label><select id="diagHasFantrax"><option value="">All</option><option value="yes" ${f.hasFantraxId==="yes"?"selected":""}>Yes</option><option value="no" ${f.hasFantraxId==="no"?"selected":""}>No</option></select></div><div><label>Has MLBAM ID</label><select id="diagHasMlbam"><option value="">All</option><option value="yes" ${f.hasMlbamId==="yes"?"selected":""}>Yes</option><option value="no" ${f.hasMlbamId==="no"?"selected":""}>No</option></select></div></div><div class="auth-actions mt-10"><button type="button" class="secondary" data-diagnostic-action="applyFilters">Apply Filters</button><button type="button" class="secondary" data-diagnostic-action="clearFilters">Clear Filters</button><button type="button" class="secondary" data-diagnostic-action="export">Export Diagnostics CSV</button></div>`;
}

function duplicateFiltersHTML(){
  return `<div class="formgrid mt-12"><div><label>Search player or normalized name</label><input id="diagSearch" value="${clean(diagnosticState.search)}" placeholder="Search duplicates"></div></div><div class="auth-actions mt-10"><button type="button" class="secondary" data-diagnostic-action="applyFilters">Apply Search</button><button type="button" class="secondary" data-diagnostic-action="clearFilters">Clear Search</button><button type="button" class="secondary" data-diagnostic-action="export">Export Diagnostics CSV</button></div>`;
}

function diagnosticRowsHTML(data){
  const rows=data?.rows||[];
  if(data?.kind==="freeAgentOwnership"){
    return `<table class="mt-12"><thead><tr><th>Player</th><th>IDs</th><th>Status</th><th>Owner</th><th>Org/Pos</th><th>Reason</th><th>Updated</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${clean(row.name)}</td><td><span class="note">${clean(row.id)}</span><br>Fantrax ${clean(row.fantrax_id||"")}<br>MLBAM ${clean(row.mlbam_id||"")}<br>${clean(row.normalized_name||"")}</td><td>Fantrax ${clean(row.roster_status||"")}<br>Roster ${clean(row.roster_status||"")}</td><td>${clean(row.owner_team_id||"")}<br>${clean(row.resolved_team_name||"")}</td><td>${clean(row.mlb_team||"")}<br>${clean(row.position||"")}</td><td>${clean(row.diagnostic_reason||"")}</td><td>${clean(row.updated_at||"")}<br><span class="note">${clean(row.latest_import_source||"")}</span></td></tr>`).join("")}</tbody></table>`;
  }
  return `<table class="mt-12"><thead><tr><th>Duplicate group</th><th>Player</th><th>IDs</th><th>Owner/Status</th><th>Org/Pos/Age</th><th>Created</th><th>Updated</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${clean(row.normalized_name)}<br><span class="note">${clean(row.duplicate_classification)} (${clean(row.duplicate_group_size)} records)</span></td><td>${clean(row.name)}</td><td><span class="note">${clean(row.id)}</span><br>Fantrax ${clean(row.fantrax_id||"")}<br>MLBAM ${clean(row.mlbam_id||"")}</td><td>${clean(row.resolved_team_name||"FREE AGENT")}<br>${clean(row.roster_status||"")}</td><td>${clean(row.mlb_team||"")}<br>${clean(row.position||"")}<br>${clean(row.age||"")}</td><td>${clean(row.created_at||"")}</td><td>${clean(row.updated_at||"")}</td></tr>`).join("")}</tbody></table>`;
}

function renderDiagnostics(data){
  const el=diagnosticPanel();
  if(!el)return;
  const page=Math.max(1,Number(data?.page)||1),pageSize=Number(data?.pageSize)||100,total=Number(data?.total)||0,totalPages=Math.max(1,Math.ceil(total/pageSize));
  const title=data?.kind==="freeAgentOwnership"?"Free-Agent Ownership Diagnostics":"Duplicate Normalized Name Diagnostics";
  const filters=data?.kind==="freeAgentOwnership"?freeAgentFiltersHTML(data):duplicateFiltersHTML();
  el.innerHTML=`<div class="panel mt-12"><h3>${title}</h3>${diagnosticSummaryHTML(data)}${filters}<p class="note mt-10">Showing ${Math.min(total,(page-1)*pageSize+1)}-${Math.min(total,page*pageSize)} of ${total}. This view is read-only.</p>${diagnosticRowsHTML(data)}<div class="auth-actions mt-10"><button type="button" class="secondary" data-diagnostic-action="prev" ${page<=1?"disabled":""}>Previous</button><button type="button" class="secondary" data-diagnostic-action="next" ${page>=totalPages?"disabled":""}>Next</button></div></div>`;
}

function readDiagnosticFilters(){
  diagnosticState.search=$("diagSearch")?.value.trim()||"";
  if(diagnosticState.kind==="freeAgentOwnership"){
    diagnosticState.filters={
      fantraxStatus:$("diagFantraxStatus")?.value||"",
      fantasyTeam:$("diagFantasyTeam")?.value||"",
      rosterStatus:$("diagRosterStatus")?.value||"",
      hasFantraxId:$("diagHasFantrax")?.value||"",
      hasMlbamId:$("diagHasMlbam")?.value||""
    };
  }else diagnosticState.filters={};
}

async function loadDiagnostic(kind,page=1){
  const leagueId=migrationState.selectedLeague?.id||cloudMigration.getSelectedLeagueId();
  if(!leagueId){setMessage("Select a cloud league before opening diagnostics.",true);return}
  diagnosticState.kind=kind;
  diagnosticState.page=page;
  diagnosticState.loading=true;
  const el=diagnosticPanel();
  if(el)el.innerHTML="<p class='note'>Loading diagnostics...</p>";
  try{
    const fetcher=kind==="freeAgentOwnership"?cloudMigration.cloudStore.getFreeAgentOwnershipDiagnostics:cloudMigration.cloudStore.getDuplicateNormalizedNameDiagnostics;
    diagnosticState.data=await fetcher(leagueId,{page,pageSize:diagnosticState.pageSize,filters:diagnosticState.filters,search:diagnosticState.search});
    renderDiagnostics(diagnosticState.data);
  }catch(e){
    if(el)el.innerHTML=`<p class="auth-error">Diagnostic load failed: ${clean(e?.message||e)}</p>`;
  }finally{
    diagnosticState.loading=false;
  }
}

async function exportDiagnosticCsv(){
  const leagueId=migrationState.selectedLeague?.id||cloudMigration.getSelectedLeagueId();
  if(!leagueId||!diagnosticState.kind)return;
  readDiagnosticFilters();
  const fetcher=diagnosticState.kind==="freeAgentOwnership"?cloudMigration.cloudStore.getFreeAgentOwnershipDiagnostics:cloudMigration.cloudStore.getDuplicateNormalizedNameDiagnostics;
  const data=await fetcher(leagueId,{page:1,pageSize:diagnosticState.pageSize,filters:diagnosticState.filters,search:diagnosticState.search,exportAll:true});
  const headers=diagnosticState.kind==="freeAgentOwnership"?freeAgentHeaders():duplicateHeaders();
  downloadCsv(`${diagnosticState.kind}-${new Date().toISOString().slice(0,10)}.csv`,data.rows||[],headers);
}

function handleDiagnosticAction(action){
  if(action==="applyFilters"){readDiagnosticFilters();loadDiagnostic(diagnosticState.kind,1);return}
  if(action==="clearFilters"){diagnosticState.search="";diagnosticState.filters={};loadDiagnostic(diagnosticState.kind,1);return}
  if(action==="prev")loadDiagnostic(diagnosticState.kind,Math.max(1,diagnosticState.page-1));
  if(action==="next")loadDiagnostic(diagnosticState.kind,diagnosticState.page+1);
  if(action==="export")exportDiagnosticCsv();
}

function classifyError(error){
  const text=String(error?.message||error||"");
  if(/configuration missing|supabase configuration/i.test(text))return{status:"config-missing",message:"Configuration missing",isError:true};
  if(/timed out|timeout/i.test(text))return{status:"network-timeout",message:"Network timeout",isError:true};
  if(/supabase library failed to load|createclient/i.test(text))return{status:"library-load-failed",message:"Supabase library failed to load",isError:true};
  if(/fetch|network|load failed|err_network|failed to fetch|cdn|import/i.test(text))return{status:"library-load-failed",message:"Supabase library failed to load",isError:true};
  return{status:"signup-failed",message:text||"Signup failed.",isError:true};
}

async function refreshSession(message){
  if(!state.service||!state.clientReady)return;
  try{
    setStatus("session-loading","Session loading",false);
    state.session=await state.service.getCurrentSession();
    state.profile=null;
    if(state.session){
      try{
        state.profile=await state.service.getCurrentProfile();
      }catch(profileError){
        console.warn("[Auth] profile lookup failed",profileError?.message||"Unknown profile error");
        state.profile={display_name:state.session.user?.user_metadata?.display_name||"",email:state.session.user?.email||""};
      }
    }
    state.status=state.session?"signed-in":"signed-out";
    if(!state.session){
      cloudRuntimeState.loadedLeagueId=null;
      setDataMode({mode:"local",leagueId:null,leagueName:null,cloudAvailable:false,message:"Local mode"});
    }
    if(message)setMessage(message,false);
  }catch(e){
    const classified=classifyError(e);
    state.localOnly=true;
    state.clientReady=false;
    setStatus(classified.status,classified.message,true);
    return;
  }
  renderAuthView();
}

async function withLoading(message,task){
  state.loading=true;
  state.message=message||statusLabel();
  setMessage(state.message,false);
  renderAuthView();
  try{
    await task();
  }finally{
    state.loading=false;
    renderAuthView();
  }
}

async function handleSignIn(event){
  event.preventDefault();
  await withLoading("Session loading",async()=>{
    const emailValue=$("authSignInEmail")?.value.trim();
    const passwordValue=$("authSignInPassword")?.value||"";
    if(!emailValue||!passwordValue){setStatus("signup-failed","Enter an email and password to sign in.",true);return}
    try{
      const { error } = await state.service.signIn(emailValue,passwordValue);
      if(error){setStatus("signup-failed",error.message||"Sign in failed.",true);return}
      state.localOnly=false;
      await refreshSession("Signed in. Select a cloud league to continue.");
      await refreshCloudLeagueState();
    }catch(e){
      const classified=classifyError(e);
      setStatus(classified.status,classified.message,true);
    }
  });
}

async function handleSignUp(event){
  event.preventDefault();
  await withLoading("Session loading",async()=>{
    console.info("[Auth] signup begins");
    if(!state.service||typeof state.service.signUp!=="function"){
      setStatus("signup-failed","Signup failed. Auth service is not ready.",true);
      return;
    }
    const emailValue=$("authSignUpEmail")?.value.trim();
    const passwordValue=$("authSignUpPassword")?.value||"";
    const displayNameValue=$("authDisplayName")?.value.trim()||"";
    if(!emailValue||!passwordValue){setStatus("signup-failed","Signup failed. Enter an email and password.",true);return}
    try{
      const { data, error } = await state.service.signUp(emailValue,passwordValue,displayNameValue);
      if(error){
        const classified=classifyError(error);
        setStatus(classified.status,classified.message,true);
        return;
      }
      if(data?.session){
        state.localOnly=false;
        state.status="account-created";
        await refreshSession("Account created. Select or create a cloud league to continue.");
      }else{
        state.status="confirmation";
        state.session=null;
        state.profile=null;
        setMessage("Check your email",false);
        renderAuthView();
      }
    }catch(e){
      const classified=classifyError(e);
      setStatus(classified.status,classified.message,true);
    }
  });
}

async function handleSignOut(){
  await withLoading("Session loading",async()=>{
    try{
      const { error } = await state.service.signOut();
      if(error){setStatus("signup-failed",error.message||"Sign out failed.",true);return}
      state.session=null;
      state.profile=null;
      state.status="signed-out";
      cloudRuntimeState.loadedLeagueId=null;
      setDataMode({mode:"local",leagueId:null,leagueName:null,cloudAvailable:false,message:"Local mode"});
      setMessage("Signed out. Local browser data was not changed.",false);
    }catch(e){
      const classified=classifyError(e);
      setStatus(classified.status,classified.message,true);
    }
  });
}

async function refreshCloudLeagueState(){
  if(!state.clientReady||!state.session){
    setDataMode({mode:"local",leagueId:null,leagueName:null,cloudAvailable:false,message:"Local mode"});
    return;
  }
  try{
    migrationState.leagues=await cloudMigration.cloudStore.getOwnedLeagues();
    const selectedId=cloudMigration.getSelectedLeagueId()||currentSettings().selectedCloudLeagueId||"";
    migrationState.selectedLeague=selectAccessibleCloudLeague(migrationState.leagues,selectedId);
    if(migrationState.selectedLeague){
      cloudMigration.setSelectedLeagueId(migrationState.selectedLeague.id);
      migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(migrationState.selectedLeague.id);
      await maybeActivateCloudMode("Cloud mode activated.");
    }else{
      cloudMigration.setSelectedLeagueId("");
      migrationState.cloudCounts=null;
      cloudRuntimeState.loadedLeagueId=null;
      setDataMode({mode:"local",leagueId:null,leagueName:null,cloudAvailable:true,message:"Cloud connected · Select league"});
    }
  }catch(e){
    console.warn("[Cloud League] league refresh failed",e?.message||"Unknown cloud refresh error");
    setDataMode({mode:"offline",leagueId:migrationState.selectedLeague?.id||null,leagueName:migrationState.selectedLeague?.name||null,cloudAvailable:false,message:"Cloud unavailable · Local fallback"});
    setMessage("Cloud is temporarily unavailable. Local fallback is active; cloud data was not overwritten.",true);
  }
  renderAuthView();
}

function selectAccessibleCloudLeague(leagues,selectedId){
  const accessible=Array.isArray(leagues)?leagues:[];
  if(accessible.length===1)return accessible[0];
  if(selectedId)return accessible.find(league=>league.id===selectedId)||null;
  return null;
}

async function handleSelectCloudLeague(){
  const leagueId=$("cloudLeagueSelect")?.value||"";
  const league=migrationState.leagues.find(item=>item.id===leagueId)||null;
  migrationState.selectedLeague=league;
  migrationState.cloudCounts=null;
  cloudRuntimeState.loadedLeagueId=null;
  if(!league){
    cloudMigration.setSelectedLeagueId("");
    setDataMode({mode:"local",leagueId:null,leagueName:null,cloudAvailable:true,message:"Cloud connected · Select league"});
    setMessage("No cloud league selected.",false);
    renderCloudMigration();
    return;
  }
  await withLoading("Loading cloud league",async()=>{
    cloudMigration.setSelectedLeagueId(league.id);
    migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(league.id);
    await maybeActivateCloudMode("Cloud mode activated.");
    setMessage(`Selected ${league.name||"cloud league"}.`,false);
  });
}

async function handleCreateCloudLeague(){
  if(!state.clientReady||!state.session){setMessage("Sign in before creating a cloud league.",true);return}
  const input={
    name:$("cloudLeagueName")?.value||"Reddit Phanatics",
    platform:$("cloudLeaguePlatform")?.value||"Fantrax",
    format:$("cloudLeagueFormat")?.value||"Dynasty",
    teamCount:$("cloudLeagueTeamCount")?.value||10,
    scoringType:$("cloudLeagueScoringType")?.value||"Head-to-Head Points"
  };
  await withLoading("Creating cloud league",async()=>{
    try{
      const { league, duplicate, user } = await cloudMigration.cloudStore.createLeague(input);
      await cloudMigration.cloudStore.createOwnerMembership(league.id,user.id);
      cloudMigration.setSelectedLeagueId(league.id);
      migrationState.selectedLeague=league;
      migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(league.id);
      await maybeActivateCloudMode("Cloud mode activated.");
      setMessage(duplicate?"Existing matching cloud league selected.":"Cloud league created.",false);
    }catch(e){
      setMessage(String(e?.message||"Cloud league creation failed.").replace(/eyJ[a-zA-Z0-9_\-.]+/g,"[redacted]"),true);
    }
  });
  await refreshCloudLeagueState();
}

function currentSettings(){
  return {...(window.DynastyDataStore?.getSettings?.()||{}),...(window.db?.settings||{})};
}

function saveModeSettings(settings){
  const merged={...currentSettings(),...settings};
  if(window.db)window.db.settings={...(window.db.settings||{}),...merged};
  window.DynastyDataStore?.saveSettings?.(merged);
  return merged;
}

function rowsById(rows){
  return new Map((rows||[]).filter(row=>row?.id).map(row=>[row.id,row]));
}

function groupBy(rows,key){
  const grouped=new Map();
  (rows||[]).forEach(row=>{
    const value=row?.[key];
    if(!value)return;
    if(!grouped.has(value))grouped.set(value,[]);
    grouped.get(value).push(row);
  });
  return grouped;
}

function latestMetric(rows){
  return [...(rows||[])].sort((a,b)=>String(b.imported_at||b.created_at||"").localeCompare(String(a.imported_at||a.created_at||"")))[0]||null;
}

function teamName(teamId,teamsById){
  return teamsById.get(teamId)?.name||"FREE AGENT";
}

function localPlayerFromCloud(player,{teamsById,metricsByPlayerId,scoresByPlayerId}){
  const owner=player.team_id?teamName(player.team_id,teamsById):(player.is_free_agent?"FREE AGENT":player.roster_status||"FREE AGENT");
  const metric=latestMetric(metricsByPlayerId.get(player.id));
  const score=latestMetric(scoresByPlayerId.get(player.id));
  const statcastType=/pitch/i.test(metric?.metric_type||"")?"pitcher":"hitter";
  return {
    id:player.id,
    cloudPlayerId:player.id,
    fantraxId:player.fantrax_id||"",
    player_id:player.mlbam_id||"",
    statcastId:player.mlbam_id||"",
    name:player.name||"",
    normalizedName:player.normalized_name||"",
    owner,
    rosterStatus:player.roster_status||owner,
    status:player.roster_status||owner,
    pos:Array.isArray(player.positions)?player.positions.join("/"):player.positions||"",
    org:player.mlb_team||"",
    age:player.age??"",
    hkbValue:player.hkb_value??"",
    overallRank:player.overall_rank??"",
    positionRank:player.position_rank??"",
    assetClass:player.asset_class||"",
    notes:player.notes||"",
    updated:String(player.updated_at||player.imported_at||new Date().toISOString()).slice(0,10),
    gmScore:score?.gm_score??"",
    breakoutScore:score?.breakout_score??"",
    championshipImpactScore:score?.championship_impact??"",
    positionalScarcityScore:score?.scarcity_score??"",
    tradeLiquidityScore:score?.trade_liquidity??"",
    marketAppreciationScore:score?.market_appreciation??"",
    dynastyRiskScore:score?.risk_score??"",
    dynastyAssetScore:score?.dynasty_asset_score??"",
    rosterPressureScore:score?.roster_pressure_score??"",
    statcastType:metric?statcastType:"",
    statcastSeason:metric?.season||"",
    statcastImported:metric?.imported_at||"",
    statcastMetrics:metric?.metrics||null,
    advancedStats:metric?{source:metric.source||"Statcast",type:statcastType,season:metric.season||"",metrics:metric.metrics||{},imported:metric.imported_at||""}:null
  };
}

function localManagerFromCloud(manager){
  return {
    id:manager.id,
    cloudManagerId:manager.id,
    teamName:manager.team_name||"",
    managerName:manager.manager_name||"",
    competitiveWindow:manager.competitive_window||"Retooling",
    tradeStyle:manager.trade_style||"",
    hkbReliance:manager.hkb_reliance||"Medium",
    preferredPlayerTypes:Array.isArray(manager.preferred_player_types)?manager.preferred_player_types.join("\n"):manager.preferred_player_types||"",
    favoriteProspects:Array.isArray(manager.favorite_prospects)?manager.favorite_prospects.join("\n"):manager.favorite_prospects||"",
    favoriteMLBTeams:Array.isArray(manager.favorite_mlb_teams)?manager.favorite_mlb_teams.join("\n"):manager.favorite_mlb_teams||"",
    negotiationNotes:manager.negotiation_notes||"",
    communicationStyle:manager.communication_style||"",
    playersHighlyValue:manager.players_highly_value||"",
    playersWillingToMove:manager.players_willing_to_move||"",
    tradeHistoryNotes:manager.trade_history_notes||"",
    lastUpdated:String(manager.updated_at||new Date().toISOString()).slice(0,10)
  };
}

function localTradeFromCloud(trade,{assetsByTradeId,teamsById}){
  const assets=assetsByTradeId.get(trade.id)||[];
  const movements=assets.map(asset=>({
    from:asset.from_team_id?teamName(asset.from_team_id,teamsById):"",
    to:asset.to_team_id?teamName(asset.to_team_id,teamsById):"",
    players:[asset.player_name].filter(Boolean)
  })).filter(move=>move.players.length);
  return {
    id:trade.external_transaction_id||trade.id,
    cloudTradeId:trade.id,
    date:String(trade.transaction_date||new Date().toISOString()).slice(0,10),
    type:trade.trade_type||"Trade",
    source:trade.source||"Supabase",
    notes:trade.notes||"",
    rows:Math.max(1,assets.length||1),
    movements,
    players:[...new Set(assets.map(asset=>asset.player_name).filter(Boolean))],
    teams:[...new Set([trade.team_a_id,trade.team_b_id,...assets.flatMap(asset=>[asset.from_team_id,asset.to_team_id])].map(id=>id&&teamName(id,teamsById)).filter(name=>name&&name!=="FREE AGENT"))]
  };
}

async function loadCloudRuntimeData(leagueId,settingsPatch){
  const cloudStore=cloudMigration.cloudStore;
  const [players,teams,managers,trades,metrics,scores,assets,preferences,snapshots,importJobs]=await Promise.all([
    cloudStore.getPlayers(leagueId),
    cloudStore.getTeams(leagueId),
    cloudStore.getManagers(leagueId),
    cloudStore.getTrades(leagueId),
    cloudStore.selectRows("player_metrics",leagueId),
    cloudStore.selectRows("calculated_player_scores",leagueId),
    cloudStore.selectRows("trade_assets",leagueId),
    cloudStore.selectRows("manager_preferences",leagueId),
    cloudStore.selectRows("player_snapshots",leagueId),
    cloudStore.selectRows("import_jobs",leagueId)
  ]);
  const teamsById=rowsById(teams);
  const metricsByPlayerId=groupBy(metrics,"player_id");
  const scoresByPlayerId=groupBy(scores,"player_id");
  const assetsByTradeId=groupBy(assets,"trade_id");
  return {
    players:players.map(player=>localPlayerFromCloud(player,{teamsById,metricsByPlayerId,scoresByPlayerId})),
    managers:managers.map(localManagerFromCloud),
    trades:trades.map(trade=>localTradeFromCloud(trade,{assetsByTradeId,teamsById})),
    snapshots,
    trends:[],
    managerPreferences:preferences,
    importJobs,
    settings:{...currentSettings(),...settingsPatch,lastCloudDataLoadedAt:new Date().toISOString(),cloudRuntimeOnly:true}
  };
}

async function activateCloudRuntime(leagueId,settingsPatch,messagePrefix){
  const league=await verifyCloudRuntimeAccess(leagueId);
  const cloudDb=await loadCloudRuntimeData(leagueId,settingsPatch);
  if(window.setRuntimeDB)window.setRuntimeDB(cloudDb,{renderAfter:true,saveLocal:false});
  else if(window.db)window.db=cloudDb;
  saveModeSettings(cloudDb.settings);
  cloudRuntimeState.loadedLeagueId=leagueId;
  importState.stages.enable="Completed";
  setDataMode({mode:"cloud",leagueId,leagueName:league?.name||migrationState.selectedLeague?.name||null,cloudAvailable:true,message:`Cloud · ${league?.name||"Selected league"}`});
  setMessage(`${messagePrefix} Loaded ${cloudDb.players.length.toLocaleString()} cloud players without deleting local browser data.`,false);
  return cloudDb;
}

async function verifyCloudRuntimeAccess(leagueId){
  if(!state.clientReady)throw new Error("Supabase client is not initialized.");
  const user=await cloudMigration.cloudStore.getCurrentUser();
  if(!user)throw new Error("Sign in before using cloud mode.");
  const league=await cloudMigration.cloudStore.getLeague(leagueId);
  if(!league)throw new Error("Selected cloud league was not found.");
  const accessible=(migrationState.leagues||[]).some(item=>item.id===leagueId)||league.owner_user_id===user.id;
  if(!accessible)throw new Error("Signed-in user cannot access the selected cloud league.");
  await cloudMigration.cloudStore.getLeagueCounts(leagueId);
  return league;
}

async function maybeActivateCloudMode(messagePrefix="Cloud mode activated."){
  const leagueId=migrationState.selectedLeague?.id||cloudMigration.getSelectedLeagueId();
  if(!leagueId||cloudRuntimeState.loading||cloudRuntimeState.loadedLeagueId===leagueId)return;
  cloudRuntimeState.loading=true;
  try{
    await activateCloudRuntime(leagueId,{preferredDataProvider:"supabase",cloudScoresNeedRecalculation:true},messagePrefix);
  }catch(e){
    console.warn("[Cloud Mode] cloud activation failed",e?.message||"Unknown cloud activation error");
    setDataMode({mode:"offline",leagueId,leagueName:migrationState.selectedLeague?.name||null,cloudAvailable:false,message:"Cloud unavailable · Local fallback"});
    setMessage("Cloud is temporarily unavailable. Local fallback is active; cloud data was not overwritten.",true);
  }finally{
    cloudRuntimeState.loading=false;
  }
}

function handleLocalMode(){
  const settings=saveModeSettings({preferredDataProvider:"local",cloudRuntimeOnly:false});
  cloudRuntimeState.loadedLeagueId=null;
  setDataMode({mode:"local",leagueId:null,leagueName:null,cloudAvailable:false,message:"Local mode"});
  const localDb=window.loadLocalDB?.();
  if(localDb&&window.setRuntimeDB)window.setRuntimeDB({...localDb,settings:{...(localDb.settings||{}),...settings}},{renderAfter:true,saveLocal:false});
  setMessage("Switched back to Local Mode. Local browser data remains the active source.",false);
  renderCloudMigration();
}

function handleCloudRecalculateScores(){
  setMessage("Player scores need recalculation from cloud data. Cloud score recalculation will be implemented in Phase 2G.",false);
}

function fileForStep(step){
  return fileInputIds[step]?$(fileInputIds[step])?.files?.[0]:null;
}

function clearImportPreview(step){
  delete importState.previews[step];
  delete importState.previewFiles[step];
  importState.stages[step]="Not started";
  const confirm=$(confirmIds[step]);
  if(confirm)confirm.checked=false;
  if(step==="fantrax"&&$("cloudConfirmFantraxTeams"))$("cloudConfirmFantraxTeams").checked=false;
  const previewEl=$("cloudImportPreview");
  if(previewEl)previewEl.innerHTML="";
  renderCloudMigration();
}

function redactedErrorMessage(error,fallback){
  return String(error?.message||fallback).replace(/eyJ[a-zA-Z0-9_\-.]+/g,"[redacted]");
}

function stageErrorMessage(stage,error,fallback){
  const detail=redactedErrorMessage(error,fallback);
  return `${stage||"Import"} failed: ${detail}`;
}

async function previewCloudImportStep(step){
  if(!migrationState.selectedLeague){setMessage("Create or select a cloud league before previewing imports.",true);return}
  if(!priorRequiredComplete(step)){setMessage("Run verification before enabling cloud data.",true);return}
  const file=fileForStep(step);
  if(!file){setMessage("Choose the source file for this import step.",true);return}
  importState.stages[step]="Parsing";
  renderCloudMigration();
  try{
    const preview=await cloudCsvImport.previewStep({step,leagueId:migrationState.selectedLeague.id,file});
    importState.previews[step]=preview;
    importState.previewFiles[step]=file;
    importState.stages[step]=preview.blockingErrors?.length?"Failed":"Preview ready";
    const confirm=$(confirmIds[step]);
    if(confirm)confirm.checked=false;
    if(step==="fantrax"&&$("cloudConfirmFantraxTeams"))$("cloudConfirmFantraxTeams").checked=false;
    renderImportPreview(step,preview);
    setMessage(preview.blockingErrors?.length?"Preview found blocking errors.":"Preview ready. Review it, then confirm before uploading.",Boolean(preview.blockingErrors?.length));
  }catch(e){
    if(step==="fantrax")console.error("[Cloud Import] Fantrax preview failed",e);
    importState.stages[step]="Failed";
    const message=step==="fantrax"?stageErrorMessage("Parsing",e,"Preview failed."):redactedErrorMessage(e,"Preview failed.");
    setMessage(message,true);
  }finally{
    renderCloudMigration();
  }
}

async function runCloudImportStep(step){
  if(!migrationState.selectedLeague){setMessage("Create or select a cloud league before importing CSV files.",true);return}
  if(!priorRequiredComplete(step)){setMessage("Run verification before enabling cloud data.",true);return}
  const needsFile=!["verification"].includes(step);
  const file=fileForStep(step);
  if(needsFile&&!file){setMessage("Choose the source file for this import step.",true);return}
  if(needsFile&&importState.previewFiles[step]&&importState.previewFiles[step]!==file){
    const detail={csvRow:"",playerName:"",fantraxId:"",mlbamId:"",team:"",actionAttempted:"Upload import file",failureReason:"Skipped because preview mismatch",suggestedResolution:"Preview the currently selected file again and confirm it before upload."};
    importExceptionState.step=step;
    renderImportProgress({step,stage:importLabels[step],processed:0,total:0,matched:0,inserted:0,updated:0,skipped:1,warnings:1,errors:0,exceptionDetails:[detail],message:"Preview this file again before uploading."});
    setMessage("Preview this file again before uploading.",true);
    return;
  }
  if(needsFile&&(!importState.previews[step]||!$(confirmIds[step])?.checked)){setMessage("Preview this file and confirm the upload before importing.",true);return}
  if(step==="fantrax"&&!$("cloudConfirmFantraxTeams")?.checked){setMessage("Confirm the detected fantasy-team list before uploading Fantrax players.",true);return}
  if(importState.previews[step]?.blockingErrors?.length){setMessage("Fix blocking preview errors before uploading.",true);return}
  importState.running=true;
  importState.cancelRequested=false;
  importState.lastStep={step,file};
  importState.stages[step]="Uploading";
  renderCloudMigration();
  try{
    const result=await cloudCsvImport.runStep({
      step,
      leagueId:migrationState.selectedLeague.id,
      file,
      reviewedPreview:importState.previews[step],
      cancelled:()=>importState.cancelRequested,
      onProgress:payload=>renderImportProgress({...payload,step})
    });
    importState.lastResult=result;
    if(step==="verification"){
      importState.verification=result;
      importState.stages.verification=result.passed?"Completed":"Partial";
      renderImportProgress(result);
    }else{
      importState.stages[step]=result.unmatched||result.errors?"Partial":"Completed";
      renderImportProgress({...result,step,stage:`${importLabels[step]} import`,total:result.processed??0,message:"Cloud import step completed."});
    }
    setMessage(step==="verification"?"Verification completed.":"Cloud import step completed.",false);
    migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(migrationState.selectedLeague.id).catch(()=>migrationState.cloudCounts);
  }catch(e){
    if(step==="fantrax")console.error("[Cloud Import] Fantrax import failed",e);
    const failedStage=importState.stages[step]||"Cloud import";
    const message=step==="fantrax"?stageErrorMessage(failedStage,e,"Cloud import failed."):redactedErrorMessage(e,"Cloud import failed.");
    const detail={csvRow:"",playerName:"",fantraxId:"",mlbamId:"",team:"",actionAttempted:`Run ${importLabels[step]||"cloud"} import`,failureReason:message,suggestedResolution:"Review the displayed error, fix the source file or cloud setup, then preview/import again."};
    importState.lastResult={error:message,errors:1,warnings:1,exceptionDetails:[detail]};
    importState.stages[step]=redactedErrorMessage(e,"")==="Import cancelled"?"Cancelled":"Failed";
    setMessage(message,true);
    renderImportProgress({step,stage:step==="fantrax"?failedStage:"Cloud import failed",message,matched:0,inserted:0,updated:0,skipped:0,warnings:1,errors:1,exceptionDetails:[detail],unmatched:0});
  }finally{
    importState.running=false;
    renderCloudMigration();
  }
}

function cancelCloudImport(){
  importState.cancelRequested=true;
  if(importState.lastStep?.step)importState.stages[importState.lastStep.step]="Cancelled";
  setMessage("Cancel requested. The current batch will finish, then import will stop.",false);
  renderCloudMigration();
}

function retryCloudImport(){
  if(importState.lastStep)runCloudImportStep(importState.lastStep.step);
}

function resetOptions(){
  return {
    players:$("cloudResetPlayers")?.checked!==false,
    trades:$("cloudResetTrades")?.checked!==false,
    teams:$("cloudResetTeams")?.checked!==false,
    managers:$("cloudResetManagers")?.checked!==false,
    importJobs:$("cloudResetImportJobs")?.checked!==false
  };
}

function resetCountsTable(counts){
  const entries=Object.entries(counts||{});
  return entries.length?`<table><thead><tr><th>Table</th><th>Rows</th></tr></thead><tbody>${entries.map(([table,count])=>`<tr><td>${clean(table)}</td><td>${clean(count)}</td></tr>`).join("")}</tbody></table>`:"<p class='note'>No selected tables.</p>";
}

async function previewCloudReset(){
  const leagueId=migrationState.selectedLeague?.id||cloudMigration.getSelectedLeagueId();
  const out=$("cloudResetPreview");
  if(!leagueId){setMessage("Select a cloud league before previewing reset counts.",true);return}
  if(out)out.innerHTML="<p class='note'>Loading reset preview...</p>";
  try{
    const preview=await cloudMigration.cloudStore.previewImportedDataReset(leagueId,{options:resetOptions()});
    if(out)out.innerHTML=`<h3>Reset Dry Run</h3><p class="note">Selected league: <b>${clean(preview.league?.name||"")}</b>. No data was deleted.</p>${resetCountsTable(preview.counts)}`;
    const run=$("cloudResetRunButton");
    if(run)run.disabled=false;
  }catch(e){
    if(out)out.innerHTML=`<p class="auth-error">Reset preview failed: ${clean(e?.message||e)}</p>`;
    const run=$("cloudResetRunButton");
    if(run)run.disabled=true;
  }
}

async function runCloudReset(){
  const league=migrationState.selectedLeague;
  const leagueId=league?.id||cloudMigration.getSelectedLeagueId();
  const out=$("cloudResetResult");
  if(!leagueId||!league){setMessage("Select a cloud league before resetting imported data.",true);return}
  const typed=$("cloudResetConfirmName")?.value||"";
  if(typed.trim()!==String(league.name||"").trim()){setMessage("Type the exact cloud league name before reset.",true);return}
  if(!window.confirm(`Reset imported cloud data for ${league.name}? This cannot be undone.`))return;
  if(out)out.innerHTML="<p class='note'>Resetting selected imported data...</p>";
  try{
    const result=await cloudMigration.cloudStore.resetImportedCloudData(leagueId,{options:resetOptions(),confirmationName:typed});
    if(out)out.innerHTML=`<h3>Reset Result ${result.passed?"PASS":"REVIEW"}</h3><p class="note">League, members, profiles, schema, RLS, auth, and Supabase configuration were preserved.</p><h4>Before</h4>${resetCountsTable(result.before)}<h4>Deleted</h4>${resetCountsTable(result.deleted)}<h4>After</h4>${resetCountsTable(result.after)}`;
    migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(leagueId).catch(()=>migrationState.cloudCounts);
    renderCloudMigration();
  }catch(e){
    if(out)out.innerHTML=`<p class="auth-error">Reset failed: ${clean(e?.message||e)}</p>`;
  }
}

function bindAuthEvents(){
  $("authSignInForm")?.addEventListener("submit",handleSignIn);
  const signupForm=$("authSignUpForm");
  if(signupForm){
    signupForm.addEventListener("submit",handleSignUp);
    state.signupHandlerRegistered=true;
    console.info("[Auth] signup submit handler registered");
  }
  $("authSignOutButton")?.addEventListener("click",handleSignOut);
  $("authRetryButton")?.addEventListener("click",()=>initCloudConnection(true));
  $("cloudCreateLeagueButton")?.addEventListener("click",handleCreateCloudLeague);
  $("cloudRefreshLeaguesButton")?.addEventListener("click",()=>refreshCloudLeagueState());
  $("cloudLeagueSelect")?.addEventListener("change",handleSelectCloudLeague);
  $("cloudRecalculateScoresButton")?.addEventListener("click",handleCloudRecalculateScores);
  Object.entries(fileInputIds).forEach(([step,id])=>$(id)?.addEventListener("change",()=>clearImportPreview(step)));
  Object.entries(previewButtonIds).forEach(([step,id])=>$(id)?.addEventListener("click",()=>previewCloudImportStep(step)));
  Object.values(confirmIds).forEach(id=>$(id)?.addEventListener("change",renderCloudMigration));
  $("cloudConfirmFantraxTeams")?.addEventListener("change",renderCloudMigration);
  $("cloudImportFantraxButton")?.addEventListener("click",()=>runCloudImportStep("fantrax"));
  $("cloudImportHkbButton")?.addEventListener("click",()=>runCloudImportStep("hkb"));
  $("cloudImportStatcastHittersButton")?.addEventListener("click",()=>runCloudImportStep("statcastHitters"));
  $("cloudImportStatcastPitchersButton")?.addEventListener("click",()=>runCloudImportStep("statcastPitchers"));
  $("cloudImportTradesButton")?.addEventListener("click",()=>runCloudImportStep("trades"));
  $("cloudImportCustomButton")?.addEventListener("click",()=>runCloudImportStep("custom"));
  $("cloudVerifyButton")?.addEventListener("click",()=>runCloudImportStep("verification"));
  $("cloudCancelImportButton")?.addEventListener("click",cancelCloudImport);
  $("cloudRetryImportButton")?.addEventListener("click",retryCloudImport);
  $("cloudResetPreviewButton")?.addEventListener("click",previewCloudReset);
  $("cloudResetRunButton")?.addEventListener("click",runCloudReset);
  $("cloudImportProgress")?.addEventListener("click",event=>{
    const importExceptionAction=event.target.closest?.("[data-import-exceptions]")?.dataset?.importExceptions;
    if(importExceptionAction==="view"){renderImportExceptionDetails();return}
    if(importExceptionAction==="export"){exportImportWarnings();return}
    const diagnosticButton=event.target.closest?.("[data-diagnostic]");
    if(diagnosticButton){loadDiagnostic(diagnosticButton.dataset.diagnostic,1);return}
    const action=event.target.closest?.("[data-diagnostic-action]")?.dataset?.diagnosticAction;
    if(action)handleDiagnosticAction(action);
  });
  $("cloudMigrationVerification")?.addEventListener("click",event=>{
    const action=event.target.closest?.("[data-diagnostic-action]")?.dataset?.diagnosticAction;
    if(action)handleDiagnosticAction(action);
  });
  $("authLocalOnlyButton")?.addEventListener("click",()=>{
    state.localOnly=true;
    setMessage("Local-only mode selected. Your current browser data remains available.",false);
    renderAuthView();
    window.goView?.("dashboard");
  });
}

async function initCloudConnection(isRetry=false){
  if(isFileProtocol()){
    state.localOnly=true;
    state.clientReady=false;
    setStatus("config-missing","Cloud authentication requires Live Server. Open the app through http://127.0.0.1.",true);
    return;
  }
  await withLoading("Library loading",async()=>{
    try{
      state.session=null;
      state.profile=null;
      state.clientReady=false;
      state.localOnly=false;
      setStatus("library-loading",isRetry?"Retrying cloud connection":"Library loading",false);
      state.service=state.service||await import("./authService.js");
      const client=await state.service.initializeAuthClient({
        onStatus:(status,message)=>setStatus(status,message,status==="config-missing")
      });
      if(!client){
        state.localOnly=true;
        state.clientReady=false;
        setStatus("config-missing","Configuration missing",true);
        return;
      }
      state.clientReady=true;
      setStatus("client-initialized","Client initialized",false);
      await refreshSession();
      state.service.subscribeToAuthChanges(async()=>{await refreshSession();await refreshCloudLeagueState()});
      setMessage(state.session?"Session restored. Select a cloud league to continue.":"Signed out. You can sign in or continue with local fallback.",false);
      await refreshCloudLeagueState();
    }catch(e){
      const classified=classifyError(e);
      state.localOnly=true;
      state.clientReady=false;
      setStatus(classified.status,classified.message,true);
    }
  });
}

function initAuth(){
  bindAuthEvents();
  renderAuthView();
  initCloudConnection(false);
}

window.DynastyAuthUI={refreshSession,renderAuthView,state,initCloudConnection};
initAuth();
