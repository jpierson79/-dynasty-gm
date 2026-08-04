import { table } from "../components/table.js";
import { escapeHtml, optionHtml } from "../utils/dom.js";

function selectedCards(players,side){
  return players.length?players.map(player=>`<div class="trade-chip"><b>${escapeHtml(player.name||player.id)}</b><span>${escapeHtml(Array.isArray(player.positions)?player.positions.join("/"):"")} ${escapeHtml(player.roster_status||"")} ${escapeHtml(player.playerStage||"")}</span><button type="button" class="secondary" data-trade-remove="${escapeHtml(player.id)}" data-trade-side="${side}">Remove</button></div>`).join(""):"<p class='note'>No assets selected.</p>";
}
function candidateTable(rows,side,selectedIds=[],{loading=false,error=""}={}){
  if(loading)return"<p class='note' aria-live='polite'>Searching players…</p>";
  if(error)return`<p class="message-panel active error">${escapeHtml(error)}</p>`;
  if(!rows.length)return"<p class='note'>No matching players.</p>";
  return table([
    {label:"Player",html:true,value:row=>`<button type="button" class="link-button" data-trade-player-detail="${escapeHtml(row.id)}">${escapeHtml(row.name||row.id)}</button>`},
    {label:"Owner",value:row=>row.ownerName||row.teams?.name||""},
    {label:"Pos",value:row=>Array.isArray(row.positions)?row.positions.join("/"):""},
    {label:"Org",value:"mlb_team"},
    {label:"Roster",value:"roster_status"},
    {label:"Stage",value:row=>row.playerStage||"UNKNOWN"},
    {label:"Dynasty",value:row=>row.score?.dynasty_asset_score??"Unavailable"},
    {label:"Overall",value:row=>row.score?.gm_score??row.scores?.overall_score??"Unavailable"},
    {label:"Impact",value:row=>row.score?.championship_impact??"Unavailable"},
    {label:"Confidence",value:row=>row.scores?.confidence_score??"Unavailable"},
    {label:"Select",html:true,value:row=>`<button type="button" class="secondary" data-trade-add-${side}="${escapeHtml(row.id)}"${selectedIds.includes(row.id)?" disabled":""}>${selectedIds.includes(row.id)?"Selected":"Select"}</button>`}
  ],rows,{className:"intelligence-table trade-candidates"});
}
function valueMetric(label,value){return `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`}
function scoreCell(player,key){
  if(key==="overall")return player?.score?.gm_score??player?.scores?.overall_score??"Unavailable";
  if(key==="dynasty")return player?.score?.dynasty_asset_score??"Unavailable";
  if(key==="impact")return player?.score?.championship_impact??"Unavailable";
  if(key==="risk")return player?.score?.risk_score??"Unavailable";
  if(key==="ceiling")return player?.scores?.ceiling_score??"Unavailable";
  if(key==="floor")return player?.scores?.floor_score??"Unavailable";
  if(key==="confidence")return player?.scores?.confidence_score??"Unavailable";
  return "Unavailable";
}
function oneForOneComparison(analysis){
  const outgoing=analysis.outgoingAssets||[];
  const incoming=analysis.incomingAssets||[];
  if(outgoing.length!==1||incoming.length!==1)return "";
  const left=outgoing[0],right=incoming[0];
  const rows=[
    {metric:"Overall",outgoing:scoreCell(left,"overall"),incoming:scoreCell(right,"overall")},
    {metric:"Dynasty",outgoing:scoreCell(left,"dynasty"),incoming:scoreCell(right,"dynasty")},
    {metric:"Championship",outgoing:scoreCell(left,"impact"),incoming:scoreCell(right,"impact")},
    {metric:"Ceiling",outgoing:scoreCell(left,"ceiling"),incoming:scoreCell(right,"ceiling")},
    {metric:"Floor",outgoing:scoreCell(left,"floor"),incoming:scoreCell(right,"floor")},
    {metric:"Risk",outgoing:scoreCell(left,"risk"),incoming:scoreCell(right,"risk")},
    {metric:"Confidence",outgoing:scoreCell(left,"confidence"),incoming:scoreCell(right,"confidence")}
  ];
  return `<h3>One-for-One Comparison</h3>${table([{label:"Metric",value:"metric"},{label:`Outgoing: ${left.name||left.id}`,value:"outgoing"},{label:`Incoming: ${right.name||right.id}`,value:"incoming"}],rows)}`;
}
function analysisPanel(analysis){
  if(!analysis)return `<section class="panel"><h3>Analysis</h3><p class="note">Choose assets from both sides, then analyze. This uses stored calculated_player_scores only.</p></section>`;
  const deltas=analysis.valueSummary?.deltas||{};
  const outgoing=analysis.valueSummary?.outgoing||{};
  const incoming=analysis.valueSummary?.incoming||{};
  const missing=(analysis.cautions||[]).filter(code=>["MISSING_MANAGER_DATA","MISSING_SCORE"].includes(code));
  return `<section class="panel trade-analysis"><h3>${escapeHtml(analysis.valueSummary?.headline||"Trade Analysis")}</h3><p class="note">Trade analysis ${escapeHtml(analysis.tradeAnalysisVersion)}. Score version ${escapeHtml(analysis.scoreVersion||"Unavailable")}.</p>
    <h3>Dynasty Value</h3>
    <div class="grid">
      ${valueMetric("Net value",analysis.valueSummary?.netValue??"")}
      ${valueMetric("Incoming package",incoming.totalPackageValue??"")}
      ${valueMetric("Outgoing package",outgoing.totalPackageValue??"")}
      ${valueMetric("Raw incoming",incoming.rawAssetValue??"")}
      ${valueMetric("Raw outgoing",outgoing.rawAssetValue??"")}
    </div>
    <h3>Win-Now Impact</h3>
    <div class="grid">${valueMetric("Present",deltas.present??"")}${valueMetric("Championship",deltas.championship??"")}${valueMetric("Floor",deltas.floor??"")}</div>
    <h3>Future Upside</h3>
    <div class="grid">${valueMetric("Future",deltas.future??"")}${valueMetric("Ceiling",deltas.ceiling??"")}${valueMetric("Portfolio fit",deltas.portfolio??"")}${valueMetric("League fit",deltas.league??"")}</div>
    <h3>Risk</h3>
    <div class="grid">${valueMetric("Risk delta",deltas.risk??"")}${valueMetric("Incoming uncertainty",incoming.uncertaintyPenalty??"")}${valueMetric("Outgoing uncertainty",outgoing.uncertaintyPenalty??"")}</div>
    <h3>Roster Construction</h3>
    <div class="grid">${valueMetric("Liquidity",deltas.liquidity??"")}${valueMetric("Depth penalty",incoming.depthRedundancyPenalty??"")}${valueMetric("Outgoing depth penalty",outgoing.depthRedundancyPenalty??"")}</div>
    <h3>Positional Effects</h3>
    <div class="grid">${valueMetric("Position delta",deltas.position??"")}${valueMetric("Need bonus",incoming.positionNeedBonus??"")}${valueMetric("Surplus penalty",outgoing.positionSurplusPenalty??"")}</div>
    <h3>Roster-Slot Effects</h3>
    <div class="grid">${valueMetric("Roster delta",deltas.roster??"")}${valueMetric("Incoming roster-slot benefit",incoming.rosterSlotBenefit??"")}${valueMetric("Outgoing roster-slot benefit",outgoing.rosterSlotBenefit??"")}</div>
    <h3>Confidence</h3>
    <div class="grid">${valueMetric("Analysis confidence",analysis.confidence??"")}${valueMetric("Incoming confidence",incoming.confidence??"")}${valueMetric("Outgoing confidence",outgoing.confidence??"")}</div>
    <h3>Missing Information</h3>
    ${missing.length?`<p class="note">${missing.map(escapeHtml).join(", ")}</p>`:"<p class='note'>No blocking missing-information warnings for this analysis.</p>"}
    ${oneForOneComparison(analysis)}
    <h3>Why</h3>
    <div class="recommendation-grid">${(analysis.explanation||[]).map(item=>`<div class="recommendation-card"><b>${escapeHtml(item.code)}</b><span class="note">${escapeHtml(item.text)}</span></div>`).join("")}</div>
    ${analysis.warnings?.length?`<h3>Warnings</h3>${table([{label:"Code",value:"code"},{label:"Player",value:"playerId"},{label:"Message",value:"message"}],analysis.warnings)}`:""}</section>`;
}
function draftsPanel(drafts){
  return `<section class="panel"><h3>Draft Sessions</h3><p class="note">Trade drafts are saved for this browser session only; no cloud draft table exists in V5.4.</p><div class="toolbar"><label>Draft name<input id="tradeDraftName" value=""></label><button id="saveTradeDraft" class="secondary">Save Draft</button></div>${drafts.length?table([
    {label:"Name",value:"name"},
    {label:"Created",value:"createdAt"},
    {label:"Last analyzed",value:"lastAnalyzedAt"},
    {label:"Analysis version",value:"analysisVersion"},
    {label:"Score version",value:"scoreVersion"},
    {label:"Open",html:true,value:row=>`<button class="secondary" data-open-trade-draft="${escapeHtml(row.id)}">Open</button>`},
    {label:"Rename",html:true,value:row=>`<button class="secondary" data-rename-trade-draft="${escapeHtml(row.id)}">Rename</button>`},
    {label:"Delete",html:true,value:row=>`<button class="danger" data-delete-trade-draft="${escapeHtml(row.id)}">Delete</button>`}
  ],drafts):"<p class='note'>No saved trade drafts this session.</p>"}</section>`;
}
function consolidationPanel(state){
  const targets=state.tradeCenter?.consolidationTargets?.targets||[];
  return `<section class="panel"><h3>Consolidation Builder</h3><p class="note">Select two to five outgoing assets, then find bounded target ideas. No trade is created automatically.</p><div class="toolbar"><button id="findConsolidationTargets" class="secondary"${(state.tradeCenter?.outgoingPlayerIds||[]).length<2?" disabled":""}>Find Targets</button></div>${targets.length?table([
    {label:"Target",value:row=>row.targetPlayer?.name||row.targetPlayerId},
    {label:"Team",value:row=>row.targetPlayer?.ownerName||row.targetTeamId},
    {label:"Package fit",value:"packageFit"},
    {label:"Value gap",value:"valueGap"},
    {label:"Roster space",value:"rosterSpace"},
    {label:"Risk",value:"risk"},
    {label:"Confidence",value:"confidence"},
    {label:"Why user might",value:"whyUserMight"},
    {label:"Why partner might",value:"whyPartnerMight"}
  ],targets):"<p class='note'>No consolidation targets loaded.</p>"}</section>`;
}
function fitsPanel(state){
  const fits=state.tradeCenter?.tradeFits?.fits||[];
  return `<section class="panel"><h3>Trade Fits</h3><p class="note">Select one outgoing player to see teams that may value that player. Manager intelligence is only labeled when rows exist.</p><div class="toolbar"><button id="findTradeFits" class="secondary"${(state.tradeCenter?.outgoingPlayerIds||[]).length!==1?" disabled":""}>Find Fits For Selected Player</button></div>${fits.length?table([
    {label:"Team",value:"teamName"},
    {label:"Fit",value:"fitScore"},
    {label:"Basis",value:"fitBasis"},
    {label:"Need",value:"positionNeed"},
    {label:"Surplus",value:"positionSurplus"},
    {label:"Confidence",value:"confidence"},
    {label:"Explanation",value:"explanation"}
  ],fits):"<p class='note'>No trade fits loaded.</p>"}</section>`;
}

export function renderTradeCenter(state){
  const trade=state.tradeCenter||{};
  const teams=(state.teams||[]).filter(team=>team.id!==trade.userTeamId);
  const outgoingSelected=trade.outgoingPlayers||[];
  const incomingSelected=trade.incomingPlayers||[];
  const selectedIds=[...(trade.outgoingPlayerIds||[]),...(trade.incomingPlayerIds||[])];
  return `<section class="view-panel trade-center"><h2>Trade Center</h2><p class="note">Uses stored player intelligence and UUID player identity. No imports, migrations, or score recalculations run here.</p>
    <div class="toolbar">
      <label>My Team<input value="${escapeHtml(trade.userTeamName||"Select My Roster team")}" disabled></label>
      <label>Partner team<select id="tradePartnerTeam"><option value="">Select partner</option>${teams.map(team=>optionHtml(team.id,team.name,trade.partnerTeamId||"")).join("")}</select></label>
      <button type="button" id="clearTrade" class="secondary">Clear Trade</button>
    </div>
    <div class="trade-layout">
      <section class="panel"><h3>My Team</h3><div class="toolbar"><label>Search my assets<input id="tradeOutgoingSearch" value="${escapeHtml(trade.myTeamSearchDraft??trade.outgoingSearch??"")}" placeholder="Player name"></label><button type="button" id="searchTradeOutgoing" class="secondary"${trade.outgoingLoading?" disabled":""}>Search</button><button type="button" id="clearTradeOutgoingSearch" class="secondary">Clear</button></div>${selectedCards(outgoingSelected,"outgoing")}${candidateTable(trade.outgoingCandidates||[],"outgoing",selectedIds,{loading:trade.outgoingLoading,error:trade.outgoingError})}</section>
      <section class="panel"><h3>Partner Team</h3><div class="toolbar"><label>Search partner assets<input id="tradeIncomingSearch" value="${escapeHtml(trade.partnerTeamSearchDraft??trade.incomingSearch??"")}" placeholder="Player name"></label><button type="button" id="searchTradeIncoming" class="secondary" ${trade.partnerTeamId&&!trade.incomingLoading?"":"disabled"}>Search</button><button type="button" id="clearTradeIncomingSearch" class="secondary">Clear</button></div>${selectedCards(incomingSelected,"incoming")}${candidateTable(trade.incomingCandidates||[],"incoming",selectedIds,{loading:trade.incomingLoading,error:trade.incomingError})}</section>
      ${analysisPanel(trade.analysis)}
    </div>
    <div class="toolbar"><button id="analyzeTrade" class="primary"${!trade.partnerTeamId||!trade.outgoingPlayerIds?.length||!trade.incomingPlayerIds?.length?" disabled":""}>Analyze Trade</button></div>
    ${trade.error?`<section class="message-panel active error">${escapeHtml(trade.error)}</section>`:""}
    <div class="two">${consolidationPanel(state)}${fitsPanel(state)}</div>
    ${draftsPanel(trade.drafts||[])}
  </section>`;
}
