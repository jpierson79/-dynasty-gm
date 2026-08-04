import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { packageValue, TRADE_ANALYSIS_VERSION, TRADE_REASON_CODES, validateTradeAssets } from "../v5/js/services/tradeAnalysisService.js";
import { renderTradeCenter } from "../v5/js/views/tradeCenterView.js";
import { addTradeAssetSelection, removeTradeAssetSelection } from "../v5/js/services/tradeInteractionService.js";

const root=new URL("../",import.meta.url);
const service=await readFile(new URL("v5/js/services/tradeAnalysisService.js",root),"utf8");
const view=await readFile(new URL("v5/js/views/tradeCenterView.js",root),"utf8");
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");
const html=await readFile(new URL("v5/index.html",root),"utf8");

function player(overrides={}){
  const scores={ceiling_score:overrides.ceiling??64,floor_score:overrides.floor??54,confidence_score:overrides.confidence??72,portfolio_fit:overrides.portfolio??55,league_fit:overrides.league??56};
  return {
    id:overrides.id||"p-1",
    name:overrides.name||"Player",
    positions:overrides.positions||["OF"],
    age:overrides.age??26,
    owner_team_id:overrides.owner_team_id??"team-a",
    roster_status:overrides.roster_status??"ACTIVE",
    playerStage:overrides.stage||"MLB_REGULAR",
    scoreVersion:"5.1.1",
    scores,
    score:{
      score_version:"5.1.1",
      dynasty_asset_score:overrides.dynasty??60,
      championship_impact:overrides.impact??58,
      risk_score:overrides.risk??45,
      trade_liquidity:overrides.liquidity??56,
      market_appreciation:overrides.market??54,
      breakout_score:overrides.breakout??50,
      explanation:{scores,metadata:{player_stage:overrides.stage||"MLB_REGULAR"}}
    }
  };
}

const context={positionWeakness:["C","SP"],positionSurplus:["OF"],rosterPressure:{activeOverTarget:0}};
const elite=player({id:"elite",name:"Elite Target",positions:["C"],dynasty:82,impact:78,ceiling:88,floor:72,risk:32,confidence:90});
const midA=player({id:"mid-a",positions:["OF"],dynasty:58,impact:55,ceiling:61,confidence:70});
const midB=player({id:"mid-b",positions:["OF"],dynasty:57,impact:53,ceiling:60,confidence:70});
const midC=player({id:"mid-c",positions:["SP"],dynasty:54,impact:50,ceiling:63,confidence:60,risk:68});
const prospect=player({id:"prospect",stage:"PROSPECT_NEAR_MLB",positions:["SS"],dynasty:62,impact:35,ceiling:78,floor:32,market:72,breakout:66});
const veteran=player({id:"veteran",age:33,positions:["1B"],dynasty:52,impact:66,ceiling:55,floor:62,market:40,breakout:35});

assert.equal(TRADE_ANALYSIS_VERSION,"5.4.0");
assert.equal(TRADE_REASON_CODES.PARTNER_VALUE_GAIN,"PARTNER_VALUE_GAIN");

const threePlayerPackage=packageValue([midA,midB,midC],context,{sends:3,receives:1});
assert.notEqual(threePlayerPackage.totalPackageValue,threePlayerPackage.rawAssetValue,"package value must not be a raw sum");
assert.ok(threePlayerPackage.diminishingPenalty>0,"extra assets should carry diminishing-return cost");

const consolidatedReturn=packageValue([elite],context,{sends:3,receives:1});
assert.ok(consolidatedReturn.consolidationPremium>0,"single elite return should receive a consolidation premium");
assert.ok(consolidatedReturn.rosterSlotValue>0,"fewer incoming assets should create roster-slot value");
assert.ok(consolidatedReturn.positionNeedBonus>0,"target at a weak position should add need value");

const surplusPackage=packageValue([midA,midB],context,{sends:2,receives:1});
assert.ok(surplusPackage.positionSurplusPenalty>0,"surplus outgoing positions should be recognized");

const prospectPackage=packageValue([prospect],{}, {sends:1,receives:1});
const veteranPackage=packageValue([veteran],{}, {sends:1,receives:1});
assert.ok(prospectPackage.futureValue>veteranPackage.futureValue,"prospects should lean future when ceiling and market scores are strong");
assert.ok(veteranPackage.presentValue>prospectPackage.presentValue,"present-impact veterans should lean present");

const lowConfidence=packageValue([player({id:"low",confidence:35})],{}, {sends:1,receives:1});
assert.ok(lowConfidence.confidence<55,"low score confidence should remain visible to analysis");

const invalid=validateTradeAssets({
  userTeamId:"team-a",
  partnerTeamId:"team-b",
  outgoingPlayers:[player({id:"x",owner_team_id:"team-b"}),player({id:"dup",owner_team_id:"team-a"})],
  incomingPlayers:[player({id:"dup",owner_team_id:"team-b"}),player({id:"y",owner_team_id:"team-a"})]
});
assert.ok(invalid.some(warning=>warning.code==="INVALID_OUTGOING_OWNER"));
assert.ok(invalid.some(warning=>warning.code==="INVALID_INCOMING_OWNER"));
assert.ok(invalid.some(warning=>warning.code==="DUPLICATE_ASSET"));
assert.ok(invalid.some(warning=>warning.code==="SAME_PLAYER_BOTH_SIDES"));

const rendered=renderTradeCenter({
  teams:[{id:"team-a",name:"Aces"},{id:"team-b",name:"Bombers"}],
  tradeCenter:{userTeamId:"team-a",userTeamName:"Aces",partnerTeamId:"team-b",outgoingPlayerIds:["mid-a"],incomingPlayerIds:["elite"],outgoingPlayers:[midA],incomingPlayers:[elite],outgoingCandidates:[midA,midB],incomingCandidates:[elite],drafts:[{id:"d1",name:"Draft",createdAt:"2026-07-27T00:00:00Z",lastAnalyzedAt:"2026-07-27T00:01:00Z",analysisVersion:"5.4.0",scoreVersion:"5.1.1"}],analysis:{tradeAnalysisVersion:"5.4.0",scoreVersion:"5.1.1",confidence:72,outgoingAssets:[midA],incomingAssets:[elite],valueSummary:{headline:"Leans toward My Team",netValue:8,outgoing:threePlayerPackage,incoming:consolidatedReturn,deltas:{present:1,future:2,championship:3,ceiling:4,floor:5,risk:-2,liquidity:1,roster:4,position:3,portfolio:1,league:1}},explanation:[{code:"CONSOLIDATION_PREMIUM",text:"Premium"}],warnings:[],cautions:[]}}
});
assert.match(rendered,/Trade Center/);
assert.match(rendered,/Partner Team/);
assert.match(rendered,/Analyze Trade/);
assert.match(rendered,/Consolidation Builder/);
assert.match(rendered,/Trade Fits/);
assert.match(rendered,/session only/);
assert.match(rendered,/Leans toward My Team/);
assert.match(rendered,/type="button"[^>]*data-trade-add-outgoing="mid-a"[^>]*disabled[^>]*>Selected</);
assert.match(rendered,/type="button"[^>]*data-trade-remove="mid-a"/);

const searchDraftRendered=renderTradeCenter({
  teams:[{id:"team-a",name:"Aces"},{id:"team-b",name:"Bombers"}],
  tradeCenter:{userTeamId:"team-a",userTeamName:"Aces",partnerTeamId:"team-b",myTeamSearchDraft:"J",partnerTeamSearchDraft:"Ohtani",outgoingPlayerIds:[],incomingPlayerIds:[],outgoingPlayers:[],incomingPlayers:[],outgoingCandidates:[midA],incomingCandidates:[elite],drafts:[]}
});
assert.match(searchDraftRendered,/id="tradeOutgoingSearch" value="J"/,"result rerender must preserve My Team draft");
assert.match(searchDraftRendered,/id="tradeIncomingSearch" value="Ohtani"/,"search drafts must remain independent");

const selectionState={userTeamId:"team-a",partnerTeamId:"team-b",outgoingPlayerIds:[],incomingPlayerIds:[],outgoingPlayers:[],incomingPlayers:[]};
const outgoingPlayer=player({id:"out-uuid",name:"Outgoing",owner_team_id:"team-a"});
const incomingPlayer=player({id:"in-uuid",name:"Incoming",owner_team_id:"team-b"});
const outgoingPatch=addTradeAssetSelection(selectionState,"outgoing",outgoingPlayer);
assert.deepEqual(outgoingPatch.outgoingPlayerIds,["out-uuid"]);
assert.equal(outgoingPatch.outgoingPlayers[0].id,"out-uuid");
const incomingPatch=addTradeAssetSelection({...selectionState,...outgoingPatch},"incoming",incomingPlayer);
assert.deepEqual(incomingPatch.incomingPlayerIds,["in-uuid"]);
assert.equal(addTradeAssetSelection({...selectionState,outgoingPlayerIds:["out-uuid"]},"incoming",outgoingPlayer).error,"That player is already selected in this trade.");
assert.match(addTradeAssetSelection(selectionState,"outgoing",{...player({id:"fa"}),owner_team_id:null,is_free_agent:true}).error,/not eligible/);
assert.match(addTradeAssetSelection(selectionState,"outgoing",incomingPlayer).error,/not eligible/);
assert.deepEqual(removeTradeAssetSelection({...selectionState,...outgoingPatch},"outgoing","out-uuid").outgoingPlayerIds,[]);
["Owner","Stage","Overall","Dynasty Value","Win-Now Impact","Future Upside","Risk","Roster Construction","Positional Effects","Roster-Slot Effects","Confidence","Missing Information","One-for-One Comparison","Created","Last analyzed","Analysis version","Score version"].forEach(label=>assert.match(rendered,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"))));

assert.match(html,/data-view="tradeCenter">Trade Center/);
assert.match(main,/renderTradeCenter/);
assert.match(main,/loadTradeCandidates/);
assert.match(main,/pageSize:25/,"Trade Center searches should be bounded");
assert.match(main,/tradeRequestIds=\{outgoing:0,incoming:0\}/,"stale searches must be isolated by side");
assert.match(main,/event\.key==="Enter"/,"Enter should execute asset search");
assert.doesNotMatch(main,/tradeOutgoingSearch"\)\?\.addEventListener\("input",debounce/,"raw typing must not query the cloud");
assert.match(main,/preserveTradeSearchDraft\("outgoing",event\.target\.value\)/);
assert.match(main,/findConsolidationTargets/);
assert.match(main,/findTradeFits/);
assert.match(main,/saveTradeDraft/);
assert.match(main,/createdAt:now/);
assert.match(main,/lastAnalyzedAt:trade\.analysis\?now/);
assert.match(main,/analysisVersion:trade\.analysis\?\.tradeAnalysisVersion/);
assert.match(service,/playerIntelligenceByIds/,"analysis should use UUIDs and stored score rows");
assert.match(service,/V5\.4 package weights/,"package weights should be documented in code");
assert.match(service,/adjustedPackageValue/);
assert.match(service,/rosterSlotBenefit/);
assert.match(service,/depthRedundancyPenalty/);
assert.match(service,/uncertaintyPenalty/);
assert.match(service,/teamContextBeforeTrade/);
assert.match(service,/partnerContextAfterTrade/);
assert.match(service,/missingDataWarnings/);
assert.match(service,/explanationMetadata/);
assert.match(service,/managerPreferences/,"manager preference rows should be used only when available");
assert.match(service,/ownerTeamId:teamId/,"consolidation should respect selected team ownership");
assert.match(service,/ownerTeamId:targetTeamId/,"target search should be bounded to selected partner when provided");
assert.match(service,/rosteredOnly:!targetTeamId/,"unscoped consolidation target discovery should stay rostered and bounded");
assert.match(service,/listManagers\(leagueId\)\.catch/,"manager intelligence must be optional");
assert.match(service,/Roster-based fit only/,"fit discovery should label roster-only analysis when manager rows are absent");
assert.match(service,/localeCompare\(String\(b\.id\)\)|localeCompare\(String\(b\.teamId\)\)|localeCompare\(String\(b\.targetPlayerId\)\)/,"stable tie-breaker should be present");
assert.doesNotMatch(service,/calculatePlayerScores|calculateLeagueScores|dynastyEngine/,"trade service must consume stored scores only");
assert.doesNotMatch(view,/calculatePlayerScores|calculateLeagueScores|dynastyEngine/,"Trade Center view must not calculate scores");
assert.doesNotMatch(service,/selectAllLeagueRows\("players"|allPlayers\(leagueId\)/,"Trade Center service must not fully preload players");
assert.match(dataHealth,/Trade analysis version/);
assert.match(dataHealth,/Trade score version available/);
assert.match(dataHealth,/Trade asset references valid/);
assert.match(dataHealth,/Trade outgoing user owned/);
assert.match(dataHealth,/Trade incoming partner owned/);
assert.match(dataHealth,/Trade duplicate references/);
assert.match(dataHealth,/Low-confidence trade analyses/);

console.log("v5TradeCenter tests passed");
