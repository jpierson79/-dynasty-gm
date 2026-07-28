import { table } from "../components/table.js";
import { PLAYER_STAGE_OPTIONS } from "../config/playerIntelligencePresets.js";
import { escapeHtml, optionHtml } from "../utils/dom.js";
import { groupedRecommendations } from "./recommendationComponents.js";

const REC_TYPES=["","ADD","WATCH","STASH","NO_ACTION"];
function score(row,key){
  const player=row.player||{};
  const scores=player.scores||{};
  const stored=player.score||{};
  const map={dynasty_asset_score:stored.dynasty_asset_score,championship_impact:stored.championship_impact,ceiling_score:scores.ceiling_score,risk_score:stored.risk_score,confidence_score:scores.confidence_score,acquisition_opportunity:scores.acquisition_opportunity};
  const value=Number(map[key]);
  return Number.isFinite(value)?value:"Unavailable";
}
function stageLabel(value){return String(value||"UNKNOWN").replaceAll("_"," ")}
function filters(state,query){
  const positions=state.positionOptions||[],mlbTeams=state.mlbTeamOptions||[];
  return `<div class="explorer-filters">
    <label>Position<select id="waiverPosition"><option value="">All positions</option>${positions.map(pos=>optionHtml(pos,pos,query.position)).join("")}</select></label>
    <label>Stage<select id="waiverStage"><option value="">All stages</option>${PLAYER_STAGE_OPTIONS.map(stage=>optionHtml(stage,stageLabel(stage),query.playerStage)).join("")}</select></label>
    <label>MLB org<select id="waiverMlbTeam"><option value="">All orgs</option>${mlbTeams.map(team=>optionHtml(team,team,query.mlbTeam)).join("")}</select></label>
    <label>Recommendation<select id="waiverRecommendation"><option value="">Any recommendation</option>${REC_TYPES.filter(Boolean).map(type=>optionHtml(type,type,query.recommendationType)).join("")}</select></label>
    <label>Data<select id="waiverData"><option value="">Any data</option>${[["hasHkb","Has HKB"],["hasStatcast","Has Statcast"],["missingMlbam","Missing MLBAM ID"]].map(([value,label])=>optionHtml(value,label,query.dataAvailability)).join("")}</select></label>
    <label>Min dynasty<input id="waiverMinDynasty" type="number" min="0" max="100" value="${escapeHtml(query.minDynastyAssetScore||"")}"></label>
    <label>Min impact<input id="waiverMinImpact" type="number" min="0" max="100" value="${escapeHtml(query.minChampionshipImpact||"")}"></label>
    <label>Min ceiling<input id="waiverMinCeiling" type="number" min="0" max="100" value="${escapeHtml(query.minCeiling||"")}"></label>
    <label>Max risk<input id="waiverMaxRisk" type="number" min="0" max="100" value="${escapeHtml(query.maxRisk||"")}"></label>
    <label>Min confidence<input id="waiverMinConfidence" type="number" min="0" max="100" value="${escapeHtml(query.minConfidence||"")}"></label>
    <label class="checkline"><input id="waiverExcludeLowInfo" type="checkbox"${query.excludeLowInformation?" checked":""}> Exclude low-information players</label>
    <button id="applyWaiverFilters" class="primary">Apply</button>
    <button id="clearWaiverFilters" class="secondary">Clear Filters</button>
  </div>`;
}
export function renderWaiverOpportunities(state,page){
  const query=state.waiverQuery||{};
  const recs=page?.recommendations||[];
  const upgrade=state.waiverUpgrade||null;
  const watchIds=state.watchListIds||[];
  const watched=recs.filter(rec=>watchIds.includes(rec.playerId));
  return `<section class="view-panel"><h2>Waiver Opportunities</h2><p class="note">Free-agent recommendations from stored V5.1.1 scores and roster context. No transactions are automatic.</p>${filters(state,query)}
  <section class="panel"><h3>Session Watch List</h3><p class="note">Watch list is in-session only in this pass because no existing cloud persistence table supports it without a migration.</p>${watched.length?watched.map(item=>`<span class="pill">${escapeHtml(item.player?.name||item.playerId)}</span>`).join(" "):"<p class='note'>No watched free agents yet.</p>"}</section>
  <p class="note">${state.waiversLoading?"Loading waiver opportunities...":state.waiversError?`Waiver query failed: ${escapeHtml(state.waiversError)}`:`Showing ${recs.length} of ${page?.count||0} free agents. Page ${query.page||1}. Rule ${escapeHtml(page?.decisionRuleVersion||"5.3.0")}.`}</p>
  ${table([
    {label:"Player",html:true,value:row=>`<button class="link-button" data-waiver-detail="${escapeHtml(row.playerId)}">${escapeHtml(row.player?.name||row.playerId)}</button>`},
    {label:"Position",value:row=>Array.isArray(row.player?.positions)?row.player.positions.join("/"):"Unavailable"},
    {label:"MLB organization",value:row=>row.player?.mlb_team||"Unavailable"},
    {label:"Player stage",value:row=>stageLabel(row.player?.playerStage)},
    {label:"Dynasty Asset Score",value:row=>score(row,"dynasty_asset_score")},
    {label:"Championship Impact",value:row=>score(row,"championship_impact")},
    {label:"Ceiling",value:row=>score(row,"ceiling_score")},
    {label:"Risk",value:row=>score(row,"risk_score")},
    {label:"Confidence",value:row=>score(row,"confidence_score")},
    {label:"Acquisition Opportunity",value:row=>score(row,"acquisition_opportunity")},
    {label:"Recommendation",value:"recommendation"},
    {label:"Priority",value:"priority"},
    {label:"Primary reason",value:row=>(row.reasonCodes||[])[0]||"Unavailable"},
    {label:"Watch",html:true,value:row=>`<button class="secondary" data-watch-player="${escapeHtml(row.playerId)}">${watchIds.includes(row.playerId)?"Unwatch":"Watch"}</button>`},
    {label:"Upgrade",html:true,value:row=>`<button class="secondary" data-waiver-upgrade="${escapeHtml(row.playerId)}">Compare</button>`}
  ],recs,{className:"intelligence-table"})}
  <div class="toolbar"><button id="prevWaivers" class="secondary"${(query.page||1)<=1?" disabled":""}>Previous</button><button id="nextWaivers" class="secondary"${(query.page||1)*(query.pageSize||50)>=(page?.count||0)?" disabled":""}>Next</button></div>
  ${groupedRecommendations(recs)}
  ${upgrade?`<section class="panel"><h3>Upgrade Analysis: ${escapeHtml(upgrade.freeAgent?.name||"Free agent")}</h3><p class="note">Compares only plausible roster competitors by position or flexible slots. This is not an automatic transaction.</p>${table([
    {label:"Rostered player",value:row=>row.player?.name||row.playerId},
    {label:"Upgrade type",value:"upgradeType"},
    {label:"Dynasty diff",value:row=>row.deltas.dynastyDiff},
    {label:"Impact diff",value:row=>row.deltas.impactDiff},
    {label:"Ceiling diff",value:row=>row.deltas.ceilingDiff},
    {label:"Risk diff",value:row=>row.deltas.riskDiff}
  ],upgrade.candidates||[])}</section>`:""}</section>`;
}
