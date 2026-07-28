import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLAYER_INTELLIGENCE_PRESETS, SCORE_SORTS } from "../v5/js/config/playerIntelligencePresets.js";
import { intelligenceRow, scoreValue } from "../v5/js/repositories/playerIntelligenceRepository.js";
import { renderPlayers } from "../v5/js/views/playersView.js";

const root=new URL("../",import.meta.url);
const repo=await readFile(new URL("v5/js/repositories/playerIntelligenceRepository.js",root),"utf8");
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const playersView=await readFile(new URL("v5/js/views/playersView.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");

const scoreRow={
  id:"score-1",
  player_id:"player-a",
  score_version:"5.1.1",
  gm_score:76,
  dynasty_asset_score:81,
  championship_impact:79,
  risk_score:26,
  trade_liquidity:77,
  market_appreciation:74,
  breakout_score:79,
  scarcity_score:52,
  roster_pressure_score:51,
  calculated_at:"2026-07-27T00:00:00Z",
  explanation:{scores:{overall_score:76,ceiling_score:86,floor_score:75,buy_low_score:55,sell_high_score:51,league_fit:58,portfolio_fit:51,acquisition_opportunity:61,confidence_score:96,trend_score:66},metadata:{player_stage:"MLB_EMERGING",confidence:{level:"HIGH",hasHkb:true,hasStableId:true,hasRoster:true,metricCount:6},trend:{source:"hitter",status:"IMPROVING",confidence:1}}},
  players:{id:"player-a",name:"Juan Soto",positions:["OF"],mlb_team:"NYM",age:27,fantrax_id:"FTX",mlbam_id:665742,owner_team_id:"team-a",roster_status:"ACTIVE",hkb_value:7371,teams:{id:"team-a",name:"Aces"}}
};
const row=intelligenceRow(scoreRow);

assert.equal(scoreValue(row,"dynasty_asset_score"),81);
assert.equal(scoreValue(row,"ceiling_score"),86);
assert.equal(scoreValue(row,"confidence_score"),96);
assert.equal(row.id,"player-a");
assert.equal(row.playerStage,"MLB_EMERGING");
assert.equal(row.ownerName,"Aces");

assert.match(repo,/latestScoreVersion/);
assert.match(repo,/score_version/);
assert.match(repo,/range\(\(page-1\)\*pageSize,page\*pageSize-1\)/,"pagination should stay server bounded");
assert.match(repo,/order\("player_id",\{ascending:true\}\)/,"score pagination needs a unique id tie-breaker");
assert.match(repo,/referencedTable:"players"/,"player-field sorting should use embedded player ordering");
assert.doesNotMatch(repo,/selectAllLeagueRows\("players"/,"intelligence query must not preload all players");
assert.match(repo,/missingMlbam/);
assert.match(repo,/minDynastyAssetScore/);
assert.match(repo,/minChampionshipImpact/);
assert.match(repo,/maxRisk/);
assert.match(repo,/localFilterRows/,"explanation-only score filters are applied only to bounded page rows");
assert.match(repo,/playerIntelligenceByIds/);

assert.ok(SCORE_SORTS.some(sort=>sort.value==="buy_low_score"));
assert.equal(PLAYER_INTELLIGENCE_PRESETS.freeAgents.query.ownerTeamId,"FREE_AGENT");
assert.equal(PLAYER_INTELLIGENCE_PRESETS.upside.query.playerStage,"PROSPECT_NEAR_MLB");
assert.equal(PLAYER_INTELLIGENCE_PRESETS.buyLow.query.minConfidence,50);

const html=renderPlayers({
  teams:[{id:"team-a",name:"Aces"}],
  positionOptions:["OF"],
  mlbTeamOptions:["NYM"],
  playerQuery:{page:1,pageSize:50,sort:"dynasty_asset_score",ascending:false},
  comparisonPlayerIds:["player-a"],
  comparisonPlayers:[row,{...row,id:"player-b",name:"Other Player"}],
  selectedPlayerId:"player-a",
  selectedPlayer:row
},{rows:[row],count:1,page:1,pageSize:50,scoreVersion:"5.1.1"});
assert.match(html,/Player Intelligence Explorer/);
assert.match(html,/Dynasty Asset Score/);
assert.match(html,/Championship Impact/);
assert.match(html,/data-player-detail="player-a"/);
assert.match(html,/data-compare-player="player-a"/);
assert.match(html,/Higher means more risk\./);
assert.match(html,/Confidence describes data coverage, not player talent\./);
assert.match(html,/Raw Diagnostics/);
assert.match(html,/Player Comparison/);
assert.match(html,/player-a/);

assert.match(playersView,/scoreBar/);
assert.doesNotMatch(playersView,/calculatePlayerScores|calculateLeagueScores|dynastyEngine/,"Players view must read stored scores, not calculate them");
assert.match(main,/playerRequestId/,"stale player requests should be ignored");
assert.match(main,/debounce\(async\(\)=>/,"text search should be debounced");
assert.match(main,/comparisonPlayerIds/,"comparison must track UUIDs");
assert.match(dataHealth,/playerQuery:\{dataAvailability:"missingMlbam"/);
assert.match(dataHealth,/playerQuery:\{rosterStatus:"UNCLASSIFIED"/);
assert.match(dataHealth,/playerQuery:\{dataAvailability:"lowConfidence"/);

console.log("v5PlayerIntelligence tests passed");
