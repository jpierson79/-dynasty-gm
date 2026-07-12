const EXPORT_TYPE="dynasty-custom-intelligence";
const SCHEMA_VERSION="1.0";
const INSPECTED_KEYS=[
  "dynasty_players",
  "dynasty_managers",
  "dynasty_trades",
  "dynasty_settings",
  "dynasty_workflow",
  "dynasty_gm_front_office_v3",
  "dynasty_gm_front_office_v2",
  "dynasty_gm_front_office_v1"
];
const SECRET_PATTERN=/access_token|refresh_token|supabase|anon_key|service_role|password|authorization|bearer|sb_publishable/i;
const EXCLUDED_LABELS=[
  "Full Fantrax player pool",
  "Raw Fantrax CSV data",
  "HarryKnowsBall imported values",
  "Raw Statcast rows",
  "Large player caches",
  "Historical snapshots",
  "Calculated scores",
  "Duplicate stores",
  "Temporary workflow logs",
  "Import-job progress",
  "Authentication/session data",
  "Supabase credentials"
];

function $(id){return document.getElementById(id)}
function normalizeName(value){return window.DynastyMigrationService?.normalizeName?window.DynastyMigrationService.normalizeName(value):String(value||"").trim().toLowerCase()}
function safeRead(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):fallback;
  }catch(e){
    console.warn("[Custom Intelligence Export] malformed storage skipped",key,e?.message||"unknown");
    return fallback;
  }
}
function currentData(){
  const store=window.DynastyDataStore;
  const local=window.DynastyLocalStore;
  const fallback=window.db||{};
  return {
    players:fallback.players||store?.getPlayers?.()||local?.getPlayers?.()||safeRead("dynasty_players",[]),
    managers:fallback.managers||store?.getManagers?.()||local?.getManagers?.()||safeRead("dynasty_managers",[]),
    trades:fallback.trades||store?.getTrades?.()||local?.getTrades?.()||safeRead("dynasty_trades",[]),
    settings:fallback.settings||store?.getSettings?.()||local?.getSettings?.()||safeRead("dynasty_settings",{}),
    workflow:store?.getWorkflow?.()||local?.getWorkflow?.()||safeRead("dynasty_workflow",{})
  };
}
function legacyData(){
  return INSPECTED_KEYS.filter(key=>/^dynasty_gm_front_office_v[123]$/.test(key)).map(key=>safeRead(key,null)).filter(Boolean);
}
function stringList(value){
  return String(value||"").split(/\n|,/).map(x=>x.trim()).filter(Boolean);
}
function hasText(value){return String(value||"").trim().length>0}
function sanitize(value,seen=new WeakSet()){
  if(value===undefined||typeof value==="function")return undefined;
  if(value===null||typeof value!=="object"){
    if(typeof value==="string"&&SECRET_PATTERN.test(value))return "[redacted]";
    return value;
  }
  if(seen.has(value))return undefined;
  seen.add(value);
  if(Array.isArray(value))return value.map(item=>sanitize(item,seen)).filter(item=>item!==undefined);
  const out={};
  Object.entries(value).forEach(([key,item])=>{
    if(SECRET_PATTERN.test(key))return;
    const clean=sanitize(item,seen);
    if(clean!==undefined)out[key]=clean;
  });
  return out;
}
function managerProfiles(managers){
  return (managers||[]).map(m=>sanitize({
    teamName:m.teamName||"",
    managerName:m.managerName||"",
    competitiveWindow:m.competitiveWindow||"",
    tradeStyle:m.tradeStyle||"",
    hkbReliance:m.hkbReliance||"",
    preferredPlayerTypes:m.preferredPlayerTypes||"",
    favoriteProspects:m.favoriteProspects||"",
    favoriteMLBTeams:m.favoriteMLBTeams||"",
    negotiationNotes:m.negotiationNotes||"",
    communicationStyle:m.communicationStyle||"",
    playersHighlyValue:m.playersHighlyValue||"",
    playersWillingToMove:m.playersWillingToMove||"",
    tradeHistoryNotes:m.tradeHistoryNotes||"",
    lastUpdated:m.lastUpdated||m.updatedAt||""
  })).filter(m=>Object.values(m).some(hasText));
}
function managerPreferences(managers){
  const rows=[];
  (managers||[]).forEach(m=>{
    stringList(m.playersHighlyValue).forEach(playerName=>rows.push({managerTeamName:m.teamName,playerName,preferenceType:"highly_values",strength:4,notes:"Manager profile"}));
    stringList(m.playersWillingToMove).forEach(playerName=>rows.push({managerTeamName:m.teamName,playerName,preferenceType:"willing_to_move",strength:4,notes:"Manager profile"}));
    stringList(m.favoriteProspects).forEach(playerName=>rows.push({managerTeamName:m.teamName,playerName,preferenceType:"favorite_prospect",strength:4,notes:"Manager profile"}));
    stringList(m.preferredPlayerTypes).forEach(playerType=>rows.push({managerTeamName:m.teamName,playerName:"",playerType,preferenceType:"preferred_type",strength:3,notes:"Manager profile"}));
  });
  return sanitize(rows);
}
function customPlayerNotes(players){
  return (players||[]).filter(p=>hasText(p.notes)||hasText(p.recommendation)||hasText(p.rosterPressureAction)||hasText(p.marketEdgeRecommendation)).map(p=>sanitize({
    playerName:p.name||"",
    normalizedName:normalizeName(p.name),
    notes:p.notes||"",
    recommendation:p.recommendation||"",
    rosterPressureAction:p.rosterPressureAction||"",
    marketEdgeRecommendation:p.marketEdgeRecommendation||"",
    customRosterClassification:p.assetClass||"",
    updated:p.updated||p.updatedAt||""
  }));
}
function manualScouting(players){
  return (players||[]).filter(p=>["currentSkill","ceiling","probability","risk","catalyst"].some(k=>p[k]!==undefined&&p[k]!==null&&p[k]!=="")).map(p=>sanitize({
    playerName:p.name||"",
    normalizedName:normalizeName(p.name),
    currentSkill:p.currentSkill??null,
    ceiling:p.ceiling??null,
    probability:p.probability??null,
    risk:p.risk??null,
    catalyst:p.catalyst??null,
    notes:p.notes||""
  }));
}
function tradeNotes(trades){
  return (trades||[]).filter(t=>hasText(t.notes)||t.source==="Manual").map(t=>sanitize({
    id:t.id||"",
    date:t.date||"",
    type:t.type||"",
    source:t.source||"",
    teams:t.teams||[],
    playerNames:t.players||[],
    notes:t.notes||"",
    movements:t.movements||[]
  }));
}
function settingsBuckets(settings){
  const favorites=[],watchlists=[],pinnedItems=[],manualOverrides=[],userPreferences={},workflowNotes=[];
  Object.entries(settings||{}).forEach(([key,value])=>{
    if(SECRET_PATTERN.test(key))return;
    const low=key.toLowerCase();
    if(low.includes("favorite"))favorites.push({key,value:sanitize(value)});
    else if(low.includes("watch"))watchlists.push({key,value:sanitize(value)});
    else if(low.includes("pin"))pinnedItems.push({key,value:sanitize(value)});
    else if(low.includes("override")||low.includes("manual"))manualOverrides.push({key,value:sanitize(value)});
    else if(["myOwner","performanceMode","safeMode","leagueSettings","cloudModeEnabled","cloudLeagueId"].includes(key))userPreferences[key]=sanitize(value);
  });
  return {favorites,watchlists,pinnedItems,manualOverrides,userPreferences,workflowNotes};
}
function workflowNotes(workflow){
  const steps=Array.isArray(workflow?.steps)?workflow.steps:[];
  return steps.filter(s=>hasText(s.summary)&&!/current|ready|missing|stale|not completed/i.test(s.summary)).map(s=>sanitize({step:s.step,status:s.status,lastUpdated:s.lastUpdated,summary:s.summary}));
}
function buildExportPayload(){
  const data=currentData();
  const legacy=legacyData();
  const legacyManagers=legacy.flatMap(d=>Array.isArray(d.managers)?d.managers:[]);
  const legacyPlayers=legacy.flatMap(d=>Array.isArray(d.players)?d.players:[]);
  const legacyTrades=legacy.flatMap(d=>Array.isArray(d.trades)?d.trades:[]);
  const legacySettings=legacy.map(d=>d.settings||{}).filter(Boolean);
  const managers=[...(data.managers||[]),...legacyManagers];
  const players=[...(data.players||[]),...legacyPlayers];
  const trades=[...(data.trades||[]),...legacyTrades];
  const settings={...Object.assign({},...legacySettings),...(data.settings||{})};
  const buckets=settingsBuckets(settings);
  const payload={
    exportType:EXPORT_TYPE,
    schemaVersion:SCHEMA_VERSION,
    appVersion:window.APP_VERSION||document.getElementById("appVersion")?.textContent?.replace(/^Version\s*/,"")||"2.00",
    exportedAt:new Date().toISOString(),
    league:{name:settings.leagueSettings?.leagueName||settings.leagueName||"Dynasty League",settings:sanitize(settings.leagueSettings||{})},
    managerProfiles:managerProfiles(managers),
    managerPreferences:managerPreferences(managers),
    customPlayerNotes:customPlayerNotes(players),
    manualScouting:manualScouting(players),
    tradeNotes:tradeNotes(trades),
    favorites:buckets.favorites,
    watchlists:buckets.watchlists,
    pinnedItems:buckets.pinnedItems,
    manualOverrides:buckets.manualOverrides,
    userPreferences:buckets.userPreferences,
    workflowNotes:[...buckets.workflowNotes,...workflowNotes(data.workflow)]
  };
  return sanitize(payload);
}
function validatePayload(payload,json){
  const errors=[];
  if(json.includes("access_token")||json.includes("refresh_token")||json.includes("sb_publishable")||/"password"/i.test(json)||/"SUPABASE_/i.test(json))errors.push("Secret-like values detected.");
  if(/"players"\s*:\s*\[/.test(json)||json.includes('"statcastMetrics"')||json.includes('"hkbValue"')||json.includes('"dynastyAssetScore"'))errors.push("Excluded player/cache fields detected.");
  if(payload.exportType!==EXPORT_TYPE)errors.push("Invalid export type.");
  return errors;
}
function preview(){
  const payload=buildExportPayload();
  const json=JSON.stringify(payload,null,2);
  const counts={
    managerProfiles:payload.managerProfiles.length,
    managerPreferences:payload.managerPreferences.length,
    customPlayerNotes:payload.customPlayerNotes.length,
    manualScouting:payload.manualScouting.length,
    tradeNotes:payload.tradeNotes.length,
    favoritesWatchlists:payload.favorites.length+payload.watchlists.length,
    manualOverrides:payload.manualOverrides.length,
    workflowNotes:payload.workflowNotes.length,
    excluded:EXCLUDED_LABELS.length,
    estimatedBytes:new Blob([json]).size
  };
  return {payload,json,counts,errors:validatePayload(payload,json)};
}
function renderPreview(){
  const p=preview();
  const el=$("customIntelPreview");
  const inspect=$("customIntelInspect");
  const warn=$("customIntelWarning");
  if(el)el.innerHTML=`<div class="debug-grid">${Object.entries(p.counts).map(([k,v])=>`<div><span>${k.replace(/[A-Z]/g,m=>` ${m.toLowerCase()}`)}</span><b>${k==="estimatedBytes"?`${(v/1024).toFixed(1)} KB`:v}</b></div>`).join("")}</div>`;
  if(inspect)inspect.innerHTML=`<details><summary><b>Inspect Export Contents</b></summary><table><thead><tr><th>Category</th><th>Records</th></tr></thead><tbody>${Object.entries(p.payload).filter(([,v])=>Array.isArray(v)).map(([k,v])=>`<tr><td>${k}</td><td>${v.length}</td></tr>`).join("")}</tbody></table><p class="note">Inspected keys: ${INSPECTED_KEYS.join(", ")}</p><p class="note">Excluded: ${EXCLUDED_LABELS.join("; ")}</p></details>`;
  if(warn){
    const found=Object.entries(p.counts).filter(([k])=>!["excluded","estimatedBytes"].includes(k)).reduce((a,[,v])=>a+Number(v||0),0);
    warn.textContent=p.errors.length?p.errors.join(" "):found?"":"No custom intelligence found yet.";
    warn.className=`note mt-10 ${p.errors.length?"auth-error":""}`;
  }
  const button=$("customIntelExportButton");
  if(button)button.disabled=!$("customIntelAcknowledge")?.checked||p.errors.length>0;
  return p;
}
function downloadExport(){
  const p=renderPreview();
  if(p.errors.length)throw new Error(p.errors.join(" "));
  const blob=new Blob([p.json],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`dynasty-custom-intelligence-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  window.toast?.("Custom intelligence export created.");
}
function bind(){
  $("customIntelPreviewButton")?.addEventListener("click",renderPreview);
  $("customIntelAcknowledge")?.addEventListener("change",renderPreview);
  $("customIntelExportButton")?.addEventListener("click",()=>{
    try{downloadExport()}catch(e){const warn=$("customIntelWarning");if(warn)warn.textContent=e.message}
  });
  renderPreview();
}
bind();
