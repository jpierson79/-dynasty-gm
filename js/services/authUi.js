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
  stages:{
    fantrax:"Not started",
    hkb:"Not started",
    statcastHitters:"Not started",
    statcastPitchers:"Not started",
    trades:"Not started",
    custom:"Not started",
    verification:"Not started",
    enable:"Not started"
  }
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
  const provider=window.db?.settings?.preferredDataProvider==="supabase"?"Supabase":"Browser Local Storage";
  const header=$("cloudStatusIndicator");
  if(header){
    header.className=`cloud-status pill ${cls}`;
    header.textContent=state.localOnly&&state.status==="signed-out"?"Local-only mode":`${label} · ${provider}`;
    header.title=`Current data provider: ${provider}`;
  }
  const authStatus=$("authCloudStatus");
  if(authStatus){
    authStatus.innerHTML=`<div class="debug-grid"><div><span>Cloud account</span><b>${clean(label)}</b></div><div><span>Signed-in user</span><b>${clean(displayName()||email()||"None")}</b></div><div><span>Supabase client</span><b>${state.clientReady?"Ready":"Not ready"}</b></div><div><span>Current provider</span><b>${clean(provider)}</b></div><div><span>Browser data</span><b>Kept locally</b></div></div>`;
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
      "Local data remains available either way.";
  }
  const message=$("authMessage");
  if(message&&state.loading)message.textContent=state.message||statusLabel();
  else if(message&&!message.textContent)message.textContent=state.message;
  renderCloudMigration();
}

function localDatasetSummary(){
  const preview=migrationState.preview||cloudMigration.buildMigrationPreview();
  return preview;
}

function countGridHTML(items){
  return `<div class="debug-grid">${items.map(([label,value])=>`<div><span>${clean(label)}</span><b>${clean(value)}</b></div>`).join("")}</div>`;
}

const importSteps=["fantrax","hkb","statcastHitters","statcastPitchers","trades","custom","verification","enable"];
const importLabels={
  fantrax:"Fantrax player pool and roster",
  hkb:"HarryKnowsBall values",
  statcastHitters:"Statcast hitters",
  statcastPitchers:"Statcast pitchers",
  trades:"Fantrax trade history",
  custom:"Custom Intelligence JSON",
  verification:"Verification",
  enable:"Enable Cloud Data"
};
const confirmIds={fantrax:"cloudConfirmFantrax",hkb:"cloudConfirmHkb",statcastHitters:"cloudConfirmStatcastHitters",statcastPitchers:"cloudConfirmStatcastPitchers",trades:"cloudConfirmTrades",custom:"cloudConfirmCustom"};
const previewButtonIds={fantrax:"cloudPreviewFantraxButton",hkb:"cloudPreviewHkbButton",statcastHitters:"cloudPreviewStatcastHittersButton",statcastPitchers:"cloudPreviewStatcastPitchersButton",trades:"cloudPreviewTradesButton",custom:"cloudPreviewCustomButton"};
const importButtonIds={fantrax:"cloudImportFantraxButton",hkb:"cloudImportHkbButton",statcastHitters:"cloudImportStatcastHittersButton",statcastPitchers:"cloudImportStatcastPitchersButton",trades:"cloudImportTradesButton",custom:"cloudImportCustomButton"};

function priorRequiredComplete(step){
  if(step==="fantrax")return true;
  if(step==="hkb"||step==="statcastHitters"||step==="statcastPitchers"||step==="trades"||step==="custom")return importState.stages.fantrax==="Completed";
  if(step==="verification")return importState.stages.fantrax==="Completed";
  if(step==="enable")return importState.stages.fantrax==="Completed"&&importState.verification?.passed;
  return true;
}

function renderImportStageSummary(){
  const el=$("cloudImportStageSummary");
  if(!el)return;
  el.innerHTML=`<table><thead><tr><th>Stage</th><th>Status</th></tr></thead><tbody>${importSteps.map(step=>`<tr><td>${clean(importLabels[step])}</td><td>${clean(importState.stages[step]||"Not started")}</td></tr>`).join("")}</tbody></table>`;
}

function renderActivationStatus(){
  const provider=window.db?.settings?.preferredDataProvider==="supabase"?"Supabase":"Browser Local Storage";
  const header=$("cloudStatusIndicator");
  if(header&&state.session){
    header.textContent=provider==="Supabase"?"Signed in · Supabase data mode":"Signed in · Local data mode";
    header.className=`cloud-status pill ${provider==="Supabase"?"good":"warn"}`;
  }
  const msg=$("cloudActivationMessage");
  if(msg){
    msg.textContent=provider==="Supabase"?"Supabase is the active data source. Player scores need recalculation from cloud data.":"Cloud data mode is not active. Local browser data remains the active source.";
  }
  const recalc=$("cloudRecalculateScoresButton");
  if(recalc)recalc.disabled=provider!=="Supabase";
}

function renderCloudMigration(){
  const summary=$("cloudMigrationSummary");
  if(!summary)return;
  renderImportStageSummary();
  renderActivationStatus();
  const preview=localDatasetSummary();
  const league=migrationState.selectedLeague;
  const counts=migrationState.cloudCounts||{};
  summary.innerHTML=countGridHTML([
    ["Signed-in user",displayName()||email()||"None"],
    ["Current cloud league",league?.name||"None selected"],
    ["Local players",preview.detected.players],
    ["Local managers",preview.detected.managers],
    ["Local teams",preview.detected.teams],
    ["Local trades",preview.detected.trades],
    ["Local snapshots",preview.detected.snapshots],
    ["Local metrics",preview.detected.metrics],
    ["Cloud players",counts.players||0],
    ["Cloud managers",counts.managers||0],
    ["Cloud teams",counts.teams||0],
    ["Cloud trades",counts.trades||0],
    ["Migration status",migrationState.running?"Running":migrationState.lastResult?.ok?"Completed":migrationState.lastResult?.error?"Failed":"Not run"],
    ["Last migration date",window.db?.settings?.lastCloudMigrationAt||"Not recorded"]
  ]);
  const canUseCloud=state.clientReady&&Boolean(state.session);
  const createButton=$("cloudCreateLeagueButton"),previewButton=$("cloudPreviewMigrationButton"),runButton=$("cloudRunMigrationButton"),cancelButton=$("cloudCancelMigrationButton"),retryButton=$("cloudRetryMigrationButton"),enableButton=$("cloudEnableButton");
  if(createButton)createButton.disabled=!canUseCloud||migrationState.running;
  if(previewButton)previewButton.disabled=migrationState.running;
  if(runButton)runButton.disabled=!canUseCloud||!league||!migrationState.preview?.canRun||!$("cloudBackupReviewed")?.checked||migrationState.running;
  if(cancelButton)cancelButton.disabled=!migrationState.running;
  if(retryButton)retryButton.disabled=!migrationState.lastResult?.error||migrationState.running;
  Object.entries(previewButtonIds).forEach(([step,id])=>{const button=$(id);if(button)button.disabled=!canUseCloud||!league||importState.running||!priorRequiredComplete(step)});
  Object.entries(importButtonIds).forEach(([step,id])=>{
    const button=$(id);
    if(button)button.disabled=!canUseCloud||!league||importState.running||!priorRequiredComplete(step)||!importState.previews[step]||!$(confirmIds[step])?.checked||importState.previews[step]?.blockingErrors?.length;
  });
  const verifyButton=$("cloudVerifyButton");
  if(verifyButton)verifyButton.disabled=!canUseCloud||!league||importState.running||!priorRequiredComplete("verification");
  const cancelImport=$("cloudCancelImportButton"),retryImport=$("cloudRetryImportButton");
  if(cancelImport)cancelImport.disabled=!importState.running;
  if(retryImport)retryImport.disabled=!importState.lastStep||importState.running;
  if(enableButton)enableButton.disabled=!(importState.stages.fantrax==="Completed"&&importState.verification?.passed&&$("cloudActivationReviewed")?.checked);
}

function previewHTML(preview){
  const blocking=preview.blocking.length?`<h3>Blocking Issues</h3><ul class="edge-reasons">${preview.blocking.map(x=>`<li>${clean(x)}</li>`).join("")}</ul>`:"<p class='note'>No blocking integrity errors detected.</p>";
  return `${countGridHTML([
    ["Records detected locally",Object.values(preview.detected).reduce((a,x)=>a+Number(x||0),0)],
    ["Eligible players",preview.eligible.players],
    ["Eligible metrics",preview.eligible.metrics],
    ["Skipped players",preview.skipped.players],
    ["Duplicate normalized names",preview.duplicateNames.length],
    ["Players missing names",preview.missingNames.length],
    ["Teams missing managers",preview.teamsMissingManagers.length],
    ["Trades with unmatched players",preview.tradesWithUnmatchedPlayers.length],
    ["Metrics with unmatched players",preview.metricsWithUnmatchedPlayers.length],
    ["Invalid numeric values",preview.invalidNumbers.length],
    ["Estimated batch count",preview.estimatedBatchCount]
  ])}${blocking}`;
}

function renderMigrationProgress(payload){
  const el=$("cloudMigrationProgress");
  if(!el)return;
  if(payload?.error){
    el.innerHTML=`<p class="auth-error"><b>${clean(payload.stage||"Migration failed")}:</b> ${clean(payload.error)}</p>`;
    return;
  }
  const rows=Object.values(payload?.results||migrationState.lastResult?.results||{}).map(result=>`<tr><td>${clean(result.stage)}</td><td>${result.inserted}</td><td>${result.updated}</td><td>${result.skipped}</td><td>${result.unmatched}</td><td>${result.errors}</td></tr>`).join("");
  el.innerHTML=`<p class="note">${clean(payload?.message||payload?.stage||"Migration progress")}</p><table><thead><tr><th>Stage</th><th>Inserted</th><th>Updated</th><th>Skipped</th><th>Unmatched</th><th>Errors</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Elapsed: ${Math.round((payload?.elapsedMs||0)/1000)}s</p>`;
}

function renderVerification(verification){
  migrationState.verification=verification;
  const el=$("cloudMigrationVerification");
  if(!el)return;
  if(!verification){el.innerHTML="";renderCloudMigration();return}
  el.innerHTML=`<h3>Verification</h3><table><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${verification.checks.map(check=>`<tr><td>${clean(check.name)}</td><td>${clean(check.status)}</td><td>${clean(check.detail)}</td></tr>`).join("")}</tbody></table>`;
  renderCloudMigration();
}
function renderImportProgress(payload){
  const el=$("cloudImportProgress");
  if(!el)return;
  if(payload?.checks){
    const counts=payload.counts||{};
    el.innerHTML=`<h3>Cloud Import Verification</h3>${countGridHTML([["Teams",counts.teams||0],["Managers",counts.managers||0],["Players",counts.players||0],["Player metrics",counts.player_metrics||0],["Calculated scores",counts.calculated_player_scores||0],["Trades",counts.trades||0],["Trade assets",counts.trade_assets||0],["Snapshots",counts.player_snapshots||0]])}<table class="mt-12"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>${payload.checks.map(check=>`<tr><td>${clean(check.name)}</td><td>${clean(check.status)}</td><td>${clean(check.detail)}</td></tr>`).join("")}</tbody></table>`;
    return;
  }
  el.innerHTML=`<div class="debug-grid"><div><span>Stage</span><b>${clean(payload?.stage||"Not started")}</b></div><div><span>Processed</span><b>${clean(payload?.processed??0)} / ${clean(payload?.total??0)}</b></div><div><span>Inserted</span><b>${clean(payload?.inserted??0)}</b></div><div><span>Updated</span><b>${clean(payload?.updated??0)}</b></div><div><span>Unmatched</span><b>${clean(payload?.unmatched??0)}</b></div></div><p class="note mt-10">${clean(payload?.message||"")}</p>`;
}

function renderImportPreview(step,preview){
  const el=$("cloudImportPreview");
  if(!el)return;
  const errors=preview.blockingErrors?.length?`<h3>Blocking Errors</h3><ul class="edge-reasons">${preview.blockingErrors.map(x=>`<li>${clean(x)}</li>`).join("")}</ul>`:"<p class='note'>No blocking errors detected.</p>";
  const warnings=preview.warnings?.length?`<h3>Warnings</h3><ul class="edge-reasons">${preview.warnings.map(x=>`<li>${clean(x)}</li>`).join("")}</ul>`:"";
  const columns=(preview.columns||[]).slice(0,30).map(clean).join(", ");
  const categories=preview.categories?`<details class="mt-10"><summary><b>Inspect Custom Intelligence Categories</b></summary><table><thead><tr><th>Category</th><th>Records</th></tr></thead><tbody>${Object.entries(preview.categories).map(([key,value])=>`<tr><td>${clean(key)}</td><td>${clean(value)}</td></tr>`).join("")}</tbody></table></details>`:"";
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
    ["Cloud players loaded",preview.cloudPlayersLoaded??0],
    ["Local players loaded",preview.localPlayersLoaded??0],
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
  el.innerHTML=`<h3>${clean(importLabels[step])} Preview</h3>${countGridHTML(fantraxCounts)}<p class="note mt-10"><b>Detected columns:</b> ${columns||"JSON file"}</p>${errors}${warnings}${categories}${duplicateGroups}`;
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
      await refreshSession("Signed in. Cloud sync is still disabled until the next migration phase.");
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
        await refreshSession("Account created. Cloud sync is still disabled until the next migration phase.");
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
      setMessage("Signed out. Local browser data was not changed.",false);
    }catch(e){
      const classified=classifyError(e);
      setStatus(classified.status,classified.message,true);
    }
  });
}

async function refreshCloudLeagueState(){
  if(!state.clientReady||!state.session)return;
  try{
    migrationState.leagues=await cloudMigration.cloudStore.getOwnedLeagues();
    const selectedId=cloudMigration.getSelectedLeagueId();
    migrationState.selectedLeague=migrationState.leagues.find(league=>league.id===selectedId)||migrationState.leagues[0]||null;
    if(migrationState.selectedLeague){
      cloudMigration.setSelectedLeagueId(migrationState.selectedLeague.id);
      migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(migrationState.selectedLeague.id);
    }
  }catch(e){
    console.warn("[Cloud Migration] league refresh failed",e?.message||"Unknown cloud refresh error");
  }
  renderAuthView();
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
      setMessage(duplicate?"Existing matching cloud league selected.":"Cloud league created. No data was migrated automatically.",false);
    }catch(e){
      setMessage(String(e?.message||"Cloud league creation failed.").replace(/eyJ[a-zA-Z0-9_\-.]+/g,"[redacted]"),true);
    }
  });
  await refreshCloudLeagueState();
}

function handlePreviewMigration(){
  migrationState.preview=cloudMigration.buildMigrationPreview();
  migrationState.verification=null;
  $("cloudMigrationPreview").innerHTML=previewHTML(migrationState.preview);
  setMessage(migrationState.preview.canRun?"Migration preview ready. Review it before running.":"Migration preview found blocking issues.",!migrationState.preview.canRun);
  renderCloudMigration();
}

async function handleRunMigration(){
  if(!migrationState.selectedLeague){setMessage("Create or select a cloud league first.",true);return}
  if(!migrationState.preview)handlePreviewMigration();
  if(!migrationState.preview?.canRun){setMessage("Fix blocking preview issues before migration.",true);return}
  if(!$("cloudBackupReviewed")?.checked){setMessage("Confirm that you created a local backup and reviewed the preview.",true);return}
  migrationState.running=true;
  migrationState.cancelRequested=false;
  migrationState.lastResult=null;
  migrationState.verification=null;
  renderCloudMigration();
  const result=await cloudMigration.runMigration({
    leagueId:migrationState.selectedLeague.id,
    preview:migrationState.preview,
    cancelled:()=>migrationState.cancelRequested,
    onProgress:payload=>renderMigrationProgress(payload)
  });
  migrationState.running=false;
  migrationState.lastResult=result;
  if(result.verification)renderVerification(result.verification);
  setMessage(result.ok?"Migration completed. Local browser data was not changed.":`Migration stopped: ${result.error}`,!result.ok);
  migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(migrationState.selectedLeague.id).catch(()=>migrationState.cloudCounts);
  renderCloudMigration();
}

function handleCancelMigration(){
  migrationState.cancelRequested=true;
  setMessage("Cancel requested. The current batch will finish, then migration will stop.",false);
  renderCloudMigration();
}

function handleEnableCloudMode(){
  if(!(importState.stages.fantrax==="Completed"&&importState.verification?.passed&&$("cloudActivationReviewed")?.checked))return;
  if(window.db){
    window.db.settings={...(window.db.settings||{}),cloudModeEnabled:true,preferredDataProvider:"supabase",selectedCloudLeagueId:migrationState.selectedLeague?.id||cloudMigration.getSelectedLeagueId(),cloudScoresNeedRecalculation:true};
    window.saveDB?.(false);
  }
  importState.stages.enable="Completed";
  setMessage("Supabase data mode enabled. Local browser data was not deleted.",false);
  const msg=$("cloudActivationMessage");
  if(msg)msg.textContent="Player scores need recalculation from cloud data.";
  renderCloudMigration();
}

function handleLocalMode(){
  if(window.db){window.db.settings={...(window.db.settings||{}),cloudModeEnabled:false,preferredDataProvider:"local"};window.saveDB?.(false)}
  setMessage("Switched back to Local Mode. Local browser data remains the active source.",false);
  renderCloudMigration();
}

function handleCloudRecalculateScores(){
  setMessage("Player scores need recalculation from cloud data. Cloud score recalculation will be implemented in Phase 2G.",false);
}

function fileForStep(step){
  const ids={fantrax:"cloudFantraxFile",hkb:"cloudHkbFile",statcastHitters:"cloudStatcastHittersFile",statcastPitchers:"cloudStatcastPitchersFile",trades:"cloudTradesFile",custom:"cloudCustomFile"};
  return ids[step]?$(ids[step])?.files?.[0]:null;
}

async function previewCloudImportStep(step){
  if(!migrationState.selectedLeague){setMessage("Create or select a cloud league before previewing imports.",true);return}
  if(!priorRequiredComplete(step)){setMessage("Complete the required earlier import stage first.",true);return}
  const file=fileForStep(step);
  if(!file){setMessage("Choose the source file for this import step.",true);return}
  importState.stages[step]="Parsing";
  renderCloudMigration();
  try{
    const preview=await cloudCsvImport.previewStep({step,leagueId:migrationState.selectedLeague.id,file});
    importState.previews[step]=preview;
    importState.stages[step]=preview.blockingErrors?.length?"Failed":"Preview ready";
    const confirm=$(confirmIds[step]);
    if(confirm)confirm.checked=false;
    renderImportPreview(step,preview);
    setMessage(preview.blockingErrors?.length?"Preview found blocking errors.":"Preview ready. Review it, then confirm before uploading.",Boolean(preview.blockingErrors?.length));
  }catch(e){
    importState.stages[step]="Failed";
    setMessage(String(e?.message||"Preview failed.").replace(/eyJ[a-zA-Z0-9_\-.]+/g,"[redacted]"),true);
  }finally{
    renderCloudMigration();
  }
}

async function runCloudImportStep(step){
  if(!migrationState.selectedLeague){setMessage("Create or select a cloud league before importing CSV files.",true);return}
  if(!priorRequiredComplete(step)){setMessage("Complete the required earlier import stage first.",true);return}
  const needsFile=!["verification"].includes(step);
  const file=fileForStep(step);
  if(needsFile&&!file){setMessage("Choose the source CSV file for this import step.",true);return}
  if(needsFile&&(!importState.previews[step]||!$(confirmIds[step])?.checked)){setMessage("Preview this file and confirm the upload before importing.",true);return}
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
      cancelled:()=>importState.cancelRequested,
      onProgress:payload=>renderImportProgress(payload)
    });
    importState.lastResult=result;
    if(step==="verification"){
      importState.verification=result;
      importState.stages.verification=result.passed?"Completed":"Partial";
      renderImportProgress(result);
    }else{
      importState.stages[step]=result.unmatched||result.errors?"Partial":"Completed";
    }
    setMessage(step==="verification"?"Verification completed.":"Cloud import step completed.",false);
    migrationState.cloudCounts=await cloudMigration.cloudStore.getLeagueCounts(migrationState.selectedLeague.id).catch(()=>migrationState.cloudCounts);
  }catch(e){
    const message=String(e?.message||"Cloud import failed.").replace(/eyJ[a-zA-Z0-9_\-.]+/g,"[redacted]");
    importState.lastResult={error:message};
    importState.stages[step]=message==="Import cancelled"?"Cancelled":"Failed";
    setMessage(message,true);
    renderImportProgress({stage:"Cloud import failed",message,unmatched:0});
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
  $("cloudPreviewMigrationButton")?.addEventListener("click",handlePreviewMigration);
  $("cloudRunMigrationButton")?.addEventListener("click",handleRunMigration);
  $("cloudCancelMigrationButton")?.addEventListener("click",handleCancelMigration);
  $("cloudRetryMigrationButton")?.addEventListener("click",handleRunMigration);
  $("cloudEnableButton")?.addEventListener("click",handleEnableCloudMode);
  $("cloudLocalModeButton")?.addEventListener("click",handleLocalMode);
  $("cloudRecalculateScoresButton")?.addEventListener("click",handleCloudRecalculateScores);
  $("cloudBackupReviewed")?.addEventListener("change",renderCloudMigration);
  $("cloudActivationReviewed")?.addEventListener("change",renderCloudMigration);
  Object.entries(previewButtonIds).forEach(([step,id])=>$(id)?.addEventListener("click",()=>previewCloudImportStep(step)));
  Object.values(confirmIds).forEach(id=>$(id)?.addEventListener("change",renderCloudMigration));
  $("cloudImportFantraxButton")?.addEventListener("click",()=>runCloudImportStep("fantrax"));
  $("cloudImportHkbButton")?.addEventListener("click",()=>runCloudImportStep("hkb"));
  $("cloudImportStatcastHittersButton")?.addEventListener("click",()=>runCloudImportStep("statcastHitters"));
  $("cloudImportStatcastPitchersButton")?.addEventListener("click",()=>runCloudImportStep("statcastPitchers"));
  $("cloudImportTradesButton")?.addEventListener("click",()=>runCloudImportStep("trades"));
  $("cloudImportCustomButton")?.addEventListener("click",()=>runCloudImportStep("custom"));
  $("cloudVerifyButton")?.addEventListener("click",()=>runCloudImportStep("verification"));
  $("cloudCancelImportButton")?.addEventListener("click",cancelCloudImport);
  $("cloudRetryImportButton")?.addEventListener("click",retryCloudImport);
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
      setMessage(state.session?"Session restored. Cloud sync is still disabled until the next migration phase.":"Signed out. You can sign in or continue using local browser data.",false);
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
