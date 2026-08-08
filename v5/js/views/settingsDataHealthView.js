import { table } from "../components/table.js";
import { renderFantraxSyncAudit } from "./fantraxSyncAuditView.js?v5-4-6d-audit";

function renderSettingsDataHealthBase(state){
  const health=state.health;
  const details=state.healthDetails;
  const engine=state.engineRun||{};
  const engineProgress=engine.progress||{};
  const engineLabel=engine.running?"Cancel Score Recalculation":engine.error?"Retry Score Recalculation":"Recalculate Scores";
  const healthRunning=Boolean(state.healthRunning);
  const healthError=state.healthError||"";
  return `<section class="view-panel"><h2>Settings & Data Health</h2><div class="toolbar"><button id="runDataHealth" class="primary" ${healthRunning?"disabled":""}>${healthRunning?"Running Data Health…":"Run Data Health"}</button></div>${healthRunning?"<p class='note' role='status'>Reading and validating the active cloud league. This can take up to 60 seconds.</p>":healthError?`<p class="error" role="alert">${healthError}</p>`:""}<section class="panel"><h3>Player Engine</h3><button id="recalculateEngine" class="secondary">${engineLabel}</button><p class="note">Writes reusable intelligence to calculated_player_scores. Views read stored scores and do not calculate recommendations.</p><div id="engineProgress">${engine.running?`<p class="note">Processed ${engineProgress.processed||0} / ${engineProgress.total||0}. Upserted ${engineProgress.upserted||0}. Version ${engineProgress.engineVersion||""}.</p>`:engine.result?`<p class="note">Player Engine complete. Processed ${engine.result.processed}. Updated ${engine.result.updated}. Version ${engine.result.engineVersion}.</p>`:engine.error?`<p class="note">Player Engine stopped: ${engine.error}</p>`:""}</div></section><p class="note">Data Health is read-only.</p>${health?`<div class="grid"><div class="metric"><span>Failures</span><b>${health.failed}</b></div><div class="metric"><span>Warnings</span><b>${health.warnings}</b></div></div>${table([
    {label:"Check",value:"name"},
    {label:"Status",value:"status"},
    {label:"Details",value:row=>(row.status==="FAIL"||row.status==="WARNING")&&row.details?.count?`View Details (${row.details.count})`:""}
  ],health.checks.map((check,index)=>({...check,name:check.name,status:check.status,detailsText:(check.status==="FAIL"||check.status==="WARNING")&&check.details?.count?`View Details (${check.details.count})`:"",index}))).replaceAll("View Details",`View Details`)}`:"<p class='note'>Run Data Health to inspect the active cloud league.</p>"}${health?renderHealthActions(health):""}${renderHealthDetails(details)}</section>`;
}

export function renderSettingsDataHealth(state){return `${renderSettingsDataHealthBase(state)}${renderFantraxSyncAudit(state.fantraxSyncAttempts||[])}`}

function renderHealthActions(health){
  const alwaysVisible=["Score distribution diagnostics","Score grouping diagnostics","Score confidence coverage","Representative score sample"];
  const rows=health.checks.map((check,index)=>({check,index})).filter(item=>item.check.details?.count&&(item.check.status==="FAIL"||item.check.status==="WARNING"||alwaysVisible.includes(item.check.name)));
  return rows.length?`<div class="toolbar">${rows.map(item=>`<button class="secondary" data-health-detail="${item.index}">View Details: ${item.check.name} (${item.check.details.count})</button>`).join("")}</div>`:"";
}

function renderHealthDetails(details){
  if(!details)return"";
  const page=details.page||1,pageSize=details.pageSize||25;
  const rows=(details.rows||[]).slice((page-1)*pageSize,page*pageSize);
  return `<section class="panel"><h3>${details.name}</h3><p class="note">Read-only diagnostics. Page ${page} of ${Math.max(1,Math.ceil((details.rows||[]).length/pageSize))}.</p>${table([
    {label:"ID",value:row=>row.id||row.player_id||row.team_name||row.name||""},
    {label:"Name",value:row=>row.name||row.player_name||row.team_name||row.import_type||""},
    {label:"Detail",value:row=>JSON.stringify(row)}
  ],rows)}<div class="toolbar"><button class="secondary" id="healthPrev" ${page<=1?"disabled":""}>Previous</button><button class="secondary" id="healthNext" ${page*pageSize>=(details.rows||[]).length?"disabled":""}>Next</button></div></section>`;
}
