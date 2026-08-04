import assert from "node:assert/strict";
import { calculatePlayerScores, ENGINE_VERSION } from "../v5/js/engine/dynastyEngine.js";
import { classifyPlayerStage, PLAYER_STAGES } from "../v5/js/engine/modules/playerStage.js";
import { trendDetails } from "../v5/js/engine/modules/overallScore.js";

function player(overrides={}){
  return {
    id:overrides.id||"p",
    name:overrides.name||"Player",
    age:overrides.age??27,
    hkb_value:overrides.hkb_value??1200,
    positions:overrides.positions||["OF"],
    fantrax_id:overrides.fantrax_id??"FTX",
    mlbam_id:overrides.mlbam_id??123,
    owner_team_id:overrides.owner_team_id??"team-1",
    roster_status:overrides.roster_status??"ACTIVE",
    mlb_team:overrides.mlb_team??"NYY",
    ...overrides
  };
}

const leagueSettings={scoringType:"Head-to-Head Points",savesHolds:"Saves + Holds"};
const eliteMetrics={xwoba:.420,hard_hit_percent:57,barrel_batted_rate:18};
const averageMetrics={xwoba:.318,hard_hit_percent:39,barrel_batted_rate:7};
const poorMetrics={xwoba:.275,hard_hit_percent:28,barrel_batted_rate:3};
const strong=calculatePlayerScores({player:player({name:"Elite",hkb_value:6200,age:26,positions:["OF"]}),metrics:eliteMetrics,leagueSettings});
const average=calculatePlayerScores({player:player({name:"Average",hkb_value:900,age:29,positions:["OF"]}),metrics:averageMetrics,leagueSettings});
const replacement=calculatePlayerScores({player:player({name:"Replacement",hkb_value:80,age:32,positions:["1B"]}),metrics:poorMetrics,leagueSettings});

assert.equal(ENGINE_VERSION,"5.1.1");
assert.ok(strong.championship_impact>average.championship_impact);
assert.ok(average.championship_impact>replacement.championship_impact);
assert.ok(strong.ceiling_score>average.ceiling_score);
assert.ok(average.floor_score>replacement.floor_score);
assert.ok([strong,average,replacement].flatMap(scores=>Object.entries(scores).filter(([,value])=>Number.isFinite(value)).map(([,value])=>value)).every(value=>value>=0&&value<=100));
assert.ok(strong.championship_impact<100,"elite players should not pile up at exact 100");

const hkbOnly=calculatePlayerScores({player:player({name:"HKB Only",hkb_value:6200,age:26}),metrics:{},leagueSettings});
assert.ok(strong.championship_impact>hkbOnly.championship_impact,"rich current production should beat HKB-only confidence");
assert.ok(hkbOnly.floor_score<85,"HKB-only players should not receive elite floor scores");
assert.equal(hkbOnly.metadata.trend.status,"INSUFFICIENT_DATA");

const noHkbWithMetrics=calculatePlayerScores({player:player({name:"No HKB Metrics",hkb_value:0,age:25}),metrics:eliteMetrics,leagueSettings});
const noHkbNoMetrics=calculatePlayerScores({player:player({name:"No HKB No Metrics",hkb_value:0,age:25}),metrics:{},leagueSettings});
assert.ok(noHkbWithMetrics.championship_impact>noHkbNoMetrics.championship_impact,"missing HKB should not collapse useful Statcast evidence");

assert.equal(classifyPlayerStage({player:player({age:30}),metrics:eliteMetrics}),PLAYER_STAGES.MLB_ESTABLISHED);
assert.equal(classifyPlayerStage({player:player({age:24}),metrics:eliteMetrics}),PLAYER_STAGES.MLB_EMERGING);
assert.equal(classifyPlayerStage({player:player({age:28,hkb_value:90}),metrics:{}}),PLAYER_STAGES.MLB_ROLE_PLAYER);
assert.equal(classifyPlayerStage({player:player({age:22,roster_status:"MINORS",hkb_value:1400}),metrics:{}}),PLAYER_STAGES.PROSPECT_NEAR_MLB);
assert.equal(classifyPlayerStage({player:player({age:20,roster_status:"MINORS",hkb_value:120,owner_team_id:null,mlb_team:null}),metrics:{}}),PLAYER_STAGES.PROSPECT_DEVELOPMENTAL);
assert.equal(classifyPlayerStage({player:player({positions:["RP"],age:28}),metrics:averageMetrics}),PLAYER_STAGES.RELIEVER);
assert.equal(classifyPlayerStage({player:player({age:null,hkb_value:0,owner_team_id:null,mlb_team:null,fantrax_id:null,mlbam_id:null}),metrics:{}}),PLAYER_STAGES.UNKNOWN);

const ownedTalent=calculatePlayerScores({player:player({name:"Owned Talent",hkb_value:2400,owner_team_id:"team-1",roster_status:"ACTIVE"}),metrics:averageMetrics,leagueSettings});
const freeTalent=calculatePlayerScores({player:player({name:"Free Talent",hkb_value:2400,owner_team_id:null,roster_status:"FREE_AGENT"}),metrics:averageMetrics,leagueSettings});
assert.ok(Math.abs(ownedTalent.dynasty_asset_score-freeTalent.dynasty_asset_score)<=8,"free agency should not erase dynasty talent");
assert.ok(ownedTalent.trade_liquidity>freeTalent.trade_liquidity,"free agents should have lower trade liquidity");
assert.ok(freeTalent.acquisition_opportunity>ownedTalent.acquisition_opportunity,"free agents should be easier acquisition opportunities");

assert.equal(trendDetails({metrics:{}}).score,50);
assert.equal(trendDetails({metrics:{}}).status,"INSUFFICIENT_DATA");
assert.ok(trendDetails({metrics:eliteMetrics}).score>trendDetails({metrics:poorMetrics}).score);
assert.equal(trendDetails({metrics:{xera:2.6,whiff_percent:31,k_percent:30}}).source,"pitcher");
assert.equal(trendDetails({metrics:{metric_type:"statcast_pitching",xwoba:.260,xera:2.6,whiff_percent:31,k_percent:30}}).source,"pitcher");
assert.ok(trendDetails({metrics:{xera:5.4,whiff_percent:18,k_percent:16}}).score<50);

const eliteCatcher=calculatePlayerScores({player:player({name:"Elite C",hkb_value:5200,positions:["C"],age:27}),metrics:eliteMetrics,leagueSettings});
const ordinaryCatcher=calculatePlayerScores({player:player({name:"Ordinary C",hkb_value:450,positions:["C"],age:29}),metrics:averageMetrics,leagueSettings});
const eliteOutfielder=calculatePlayerScores({player:player({name:"Elite OF",hkb_value:5200,positions:["OF"],age:27}),metrics:eliteMetrics,leagueSettings});
assert.ok(eliteCatcher.dynasty_asset_score>ordinaryCatcher.dynasty_asset_score);
assert.ok(ordinaryCatcher.dynasty_asset_score<eliteOutfielder.dynasty_asset_score,"scarcity alone should not make an ordinary catcher top tier");

const starter=calculatePlayerScores({player:player({name:"Starter",positions:["SP"],hkb_value:2200}),metrics:{xera:3.1,whiff_percent:29,k_percent:28},leagueSettings});
const reliever=calculatePlayerScores({player:player({name:"Closer",positions:["RP"],hkb_value:1600}),metrics:{xera:2.9,whiff_percent:32,k_percent:31},leagueSettings});
assert.ok(starter.league_fit>average.league_fit,"points settings should value starters");
assert.ok(reliever.league_fit>=average.league_fit,"saves/holds relievers should not be buried by fit");

console.log("v5EngineCalibration tests passed");
