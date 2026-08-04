import { table } from "../components/table.js";
import { PLAYER_INTELLIGENCE_PRESETS, PLAYER_STAGE_OPTIONS, SCORE_SORTS } from "../config/playerIntelligencePresets.js";
import { escapeHtml, optionHtml } from "../utils/dom.js";

const PRIMARY=[
  ["dynasty_asset_score","Dynasty Asset Score"],["overall_score","Overall Score"],["championship_impact","Championship Impact"],
  ["ceiling_score","Ceiling"],["floor_score","Floor"],["risk_score","Risk"],["confidence_score","Confidence"]
];
const SECONDARY=[
  ["trade_liquidity","Trade Liquidity"],["market_appreciation","Market Appreciation"],["breakout_probability","Breakout Probability"],
  ["buy_low_score","Buy Low"],["sell_high_score","Sell High"],["scarcity","Scarcity"],["league_fit","League Fit"],
  ["portfolio_fit","Portfolio Fit"],["acquisition_opportunity","Acquisition Opportunity"],["trend_score","Trend"]
];
function display(value,fallback="Unavailable"){
  return value===null||value===undefined||value===""?fallback:value;
}
function score(row,key){
  const scores=row.scores||row.score?.explanation?.scores||{};
  const stored=row.score||{};
  const map={dynasty_asset_score:stored.dynasty_asset_score,overall_score:stored.gm_score,championship_impact:stored.championship_impact,ceiling_score:scores.ceiling_score,floor_score:scores.floor_score,risk_score:stored.risk_score,confidence_score:scores.confidence_score,trade_liquidity:stored.trade_liquidity,market_appreciation:stored.market_appreciation,breakout_probability:stored.breakout_score,buy_low_score:scores.buy_low_score,sell_high_score:scores.sell_high_score,scarcity:stored.scarcity_score??scores.scarcity,league_fit:scores.league_fit,portfolio_fit:stored.roster_pressure_score??scores.portfolio_fit,acquisition_opportunity:scores.acquisition_opportunity,trend_score:scores.trend_score};
  const value=Number(map[key]);
  return Number.isFinite(value)?value:null;
}
function scoreText(row,key){const value=score(row,key);return value===null?"Unavailable":String(value)}
function scoreBar(row,key,label){
  const value=score(row,key);
  const width=value===null?0:Math.max(0,Math.min(100,value));
  return `<div class="score-row"><span>${escapeHtml(label)}</span><div class="score-track"><i style="width:${width}%"></i></div><b>${escapeHtml(value===null?"Unavailable":value)}</b></div>`;
}
function stageLabel(value){return String(value||"UNKNOWN").replaceAll("_"," ")}
function selected(value,current){return String(value)===String(current)?" selected":""}
function checked(value){return value?" checked":""}
function numInput(id,label,value,attrs=""){
  return `<label>${label}<input id="${id}" type="number" min="0" max="100" value="${escapeHtml(value||"")}" ${attrs}></label>`;
}
function presetButtons(query){
  return `<div class="preset-strip">${Object.entries(PLAYER_INTELLIGENCE_PRESETS).map(([key,preset])=>`<button class="secondary${query.preset===key?" active":""}" data-player-preset="${key}" title="${escapeHtml(JSON.stringify(preset.query))}">${escapeHtml(preset.label)}</button>`).join("")}</div>`;
}
function filters(state,query){
  const teams=state.teams||[],positions=state.positionOptions||[],mlbTeams=state.mlbTeamOptions||[];
  return `<div class="explorer-filters">
    <label>Search<input id="playerSearch" value="${escapeHtml(state.playerSearchDraft??query.search??"")}" placeholder="Player name"></label>
    <label>Position<select id="positionFilter"><option value="">All positions</option>${positions.map(pos=>optionHtml(pos,pos,query.position)).join("")}</select></label>
    <label>MLB org<select id="mlbTeamFilter"><option value="">All orgs</option>${mlbTeams.map(team=>optionHtml(team,team,query.mlbTeam)).join("")}</select></label>
    <label>Fantasy owner<select id="ownerFilter"><option value="">All owners</option><option value="FREE_AGENT"${selected("FREE_AGENT",query.ownerTeamId)}>Free agents</option>${teams.map(team=>optionHtml(team.id,team.name,query.ownerTeamId)).join("")}</select></label>
    <label>Roster status<input id="rosterStatusFilter" value="${escapeHtml(query.rosterStatus||"")}" placeholder="ACTIVE, RESERVE, IL"></label>
    <label>Player stage<select id="playerStageFilter"><option value="">All stages</option>${PLAYER_STAGE_OPTIONS.map(stage=>optionHtml(stage,stageLabel(stage),query.playerStage)).join("")}</select></label>
    <label>Data<select id="dataAvailabilityFilter"><option value="">Any data</option>${[["hasHkb","Has HKB"],["hasStatcast","Has Statcast"],["hasMlbam","Has MLBAM ID"],["missingMlbam","Missing MLBAM ID"],["highConfidence","High confidence"],["lowConfidence","Low confidence"]].map(([value,label])=>optionHtml(value,label,query.dataAvailability)).join("")}</select></label>
    <label>Context<select id="contextFilter"><option value="">Any context</option><option value="free"${selected("free",query.context)}>Free agents only</option><option value="rostered"${selected("rostered",query.context)}>Rostered only</option></select></label>
    <label>Sort<select id="playerSort"><option value="name"${selected("name",query.sort)}>Player name</option>${SCORE_SORTS.map(sort=>optionHtml(sort.value,sort.label,query.sort)).join("")}<option value="hkb_value"${selected("hkb_value",query.sort)}>HKB value</option></select></label>
    <label>Direction<select id="sortDirection"><option value="false"${selected(false,query.ascending)}>High to low</option><option value="true"${selected(true,query.ascending)}>Low to high</option></select></label>
    ${numInput("minDynastyAssetScore","Min dynasty",query.minDynastyAssetScore)}
    ${numInput("minChampionshipImpact","Min impact",query.minChampionshipImpact)}
    ${numInput("minCeiling","Min ceiling",query.minCeiling)}
    ${numInput("maxRisk","Max risk",query.maxRisk)}
    ${numInput("minConfidence","Min confidence",query.minConfidence)}
    ${numInput("minBreakoutProbability","Min breakout",query.minBreakoutProbability)}
    ${numInput("minBuyLowScore","Min buy low",query.minBuyLowScore)}
    ${numInput("minAcquisitionOpportunity","Min acquisition",query.minAcquisitionOpportunity)}
    <label>Page size<select id="pageSize"><option${query.pageSize===25?" selected":""}>25</option><option${query.pageSize===50?" selected":""}>50</option><option${query.pageSize===100?" selected":""}>100</option></select></label>
    <label class="checkline"><input id="freeAgentsOnly" type="checkbox"${checked(query.freeAgentsOnly)}> Free agents only</label>
    <label class="checkline"><input id="rosteredOnly" type="checkbox"${checked(query.rosteredOnly)}> Rostered only</label>
    <button type="button" id="playerSearchButton" class="primary">Apply</button>
    <button type="button" id="clearPlayerFilters" class="secondary">Clear Filters</button>
  </div>`;
}
function playerTable(rows,state,comparisonIds=[]){
  const teams=state.teams||[];
  return table([
    {label:"Compare",html:true,value:row=>`<input type="checkbox" data-compare-player="${escapeHtml(row.id)}"${comparisonIds.includes(row.id)?" checked":""} aria-label="Compare ${escapeHtml(row.name)}">`},
    {label:"Player",html:true,value:row=>`<button class="link-button" data-player-detail="${escapeHtml(row.id)}">${escapeHtml(row.name||"Unavailable")}</button>`},
    {label:"Position",value:row=>Array.isArray(row.positions)?row.positions.join("/"):"Unavailable"},
    {label:"MLB team",value:row=>display(row.mlb_team)},
    {label:"Fantasy owner",value:row=>row.ownerName||teams.find(team=>team.id===row.owner_team_id)?.name||"Free agent"},
    {label:"Roster status",value:row=>display(row.roster_status)},
    {label:"Player stage",value:row=>stageLabel(row.playerStage)},
    ...PRIMARY.map(([key,label])=>({label,value:row=>scoreText(row,key)}))
  ],rows,{className:"intelligence-table"});
}
function scoreSection(title,items,row){
  return `<section><h3>${escapeHtml(title)}</h3><div class="score-list">${items.map(([key,label])=>scoreBar(row,key,label)).join("")}</div></section>`;
}
function drawer(row){
  if(!row)return"";
  const metadata=row.score?.explanation?.metadata||{};
  const confidence=metadata.confidence||{};
  const trend=metadata.trend||{};
  const sources=[confidence.hasHkb?"HKB":null,confidence.metricCount?"Statcast":null,confidence.hasStableId?"External identity":null,confidence.hasRoster?"Roster context":null].filter(Boolean);
  const missing=[!confidence.hasHkb?"HKB":null,!confidence.metricCount?"Statcast":null,!row.mlbam_id?"MLBAM ID":null].filter(Boolean);
  return `<aside class="drawer" aria-label="Player Intelligence">
    <div class="drawer-head"><div><h2>${escapeHtml(row.name||"Player")}</h2><p class="note">${escapeHtml([Array.isArray(row.positions)?row.positions.join("/"):null,row.mlb_team,row.age?`Age ${row.age}`:null].filter(Boolean).join(" - ")||"Identity unavailable")}</p></div><button id="closePlayerDetail" class="secondary">Close</button></div>
    <div class="detail-grid"><section><h3>Identity</h3><dl><dt>Fantrax ID</dt><dd>${escapeHtml(display(row.fantrax_id))}</dd><dt>MLBAM ID</dt><dd>${escapeHtml(display(row.mlbam_id))}</dd><dt>Score version</dt><dd>${escapeHtml(display(row.scoreVersion))}</dd><dt>Calculated</dt><dd>${escapeHtml(display(row.calculatedAt))}</dd></dl></section>
    <section><h3>League Context</h3><dl><dt>Owner</dt><dd>${escapeHtml(row.ownerName||"Free agent")}</dd><dt>Roster status</dt><dd>${escapeHtml(display(row.roster_status))}</dd><dt>Player stage</dt><dd>${escapeHtml(stageLabel(row.playerStage))}</dd><dt>Confidence</dt><dd>${escapeHtml(row.confidenceLevel)}</dd></dl></section></div>
    ${scoreSection("Primary Scores",PRIMARY,row)}
    ${scoreSection("Secondary Scores",SECONDARY,row)}
    <section><h3>Explanation</h3><dl><dt>Risk label</dt><dd>Higher means more risk.</dd><dt>Confidence label</dt><dd>Confidence describes data coverage, not player talent.</dd><dt>Data sources</dt><dd>${escapeHtml(sources.join(", ")||"Unavailable")}</dd><dt>Missing sources</dt><dd>${escapeHtml(missing.join(", ")||"None detected")}</dd><dt>Trend source</dt><dd>${escapeHtml(trend.source||"Unavailable")} (${escapeHtml(trend.status||"Unavailable")})</dd><dt>Ownership context</dt><dd>${escapeHtml(row.owner_team_id?"Rostered":"Free agent")}</dd></dl></section>
    <details><summary>Raw Diagnostics</summary><pre>${escapeHtml(JSON.stringify(row.score?.explanation||{},null,2))}</pre></details>
  </aside>`;
}
function comparison(rows){
  if(!rows?.length)return"";
  if(rows.length<2)return `<section class="panel comparison"><h3>Player Comparison</h3><p class="note">Select one more player to compare stored scores side by side.</p></section>`;
  const [a,b]=rows;
  return `<section class="panel comparison"><div class="drawer-head"><h3>Player Comparison</h3><button id="clearComparison" class="secondary">Clear Comparison</button></div><p class="note">Comparison uses player UUIDs and stored scores only. It does not declare a trade winner.</p>${table([
    {label:"Field",value:"label"},
    {label:a.name||a.id,value:row=>row.a},
    {label:b.name||b.id,value:row=>row.b},
    {label:"Difference",value:row=>row.diff}
  ],[
    {label:"UUID",a:a.id,b:b.id,diff:""},
    {label:"Owner",a:a.ownerName||"Free agent",b:b.ownerName||"Free agent",diff:""},
    {label:"Stage",a:stageLabel(a.playerStage),b:stageLabel(b.playerStage),diff:""},
    {label:"Confidence",a:a.confidenceLevel,b:b.confidenceLevel,diff:""},
    ...[["dynasty_asset_score","Dynasty Asset Score"],["overall_score","Overall Score"],["championship_impact","Championship Impact"],["ceiling_score","Ceiling"],["floor_score","Floor"],["risk_score","Risk"],["trade_liquidity","Trade Liquidity"],["market_appreciation","Market Appreciation"],["breakout_probability","Breakout Probability"],["league_fit","League Fit"],["confidence_score","Confidence"]].map(([key,label])=>{const av=score(a,key),bv=score(b,key);return {label,a:display(av),b:display(bv),diff:av!==null&&bv!==null?Math.abs(av-bv)>=8?`${av-bv>0?"+":""}${av-bv}`:"Close":"Unavailable"}})
  ],{className:"comparison-table"})}</section>`;
}
export function renderPlayers(state,page){
  const query=state.playerQuery;
  const rows=page?.rows||[];
  const selected=state.selectedPlayerId?(rows.find(row=>row.id===state.selectedPlayerId)||state.selectedPlayer||null):null;
  const comparisonRows=state.comparisonPlayers||[];
  return `<section class="view-panel player-explorer"><h2>Player Intelligence Explorer</h2><p class="note">Stored V5.1.1 intelligence from calculated_player_scores. Missing values display as unavailable.</p>${presetButtons(query)}${filters(state,query)}<div id="playerResults">${renderPlayerResults(state,page)}</div>${comparison(comparisonRows)}${drawer(selected)}</section>`;
}

export function renderPlayerResults(state,page){
  const query=state.playerQuery,rows=page?.rows||[];
  return `<p class="note" aria-live="polite">${state.playersLoading?"Loading players...":state.playersError?`Player query failed: ${escapeHtml(state.playersError)}`:`Showing ${rows.length} of ${page?.count||0} matching players. Page ${query.page}. Score version ${escapeHtml(page?.scoreVersion||query.scoreVersion||"latest")}.`}</p>${playerTable(rows,state,state.comparisonPlayerIds||[])}<div class="toolbar"><button type="button" id="prevPlayers" class="secondary"${query.page<=1?" disabled":""}>Previous</button><button type="button" id="nextPlayers" class="secondary"${query.page*query.pageSize>=(page?.count||0)?" disabled":""}>Next</button></div>`;
}
