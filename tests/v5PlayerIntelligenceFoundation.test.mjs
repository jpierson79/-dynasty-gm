import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCanonicalPlayerIntelligenceInput, INPUT_AVAILABILITY, loadCanonicalPlayerIntelligenceInput, PLAYER_INTELLIGENCE_INPUT_VERSION } from "../v5/js/services/playerIntelligenceInputService.js";
import { buildPlayerIntelligenceFoundation, COMPONENT_CODES, COMPONENT_STATUS, componentResult, explanation, scenarioContract } from "../v5/js/engine/playerIntelligenceFoundation.js";
import { calculatePlayerScores, ENGINE_VERSION } from "../v5/js/engine/dynastyEngine.js";

const leagueId="11111111-1111-4111-8111-111111111111",playerId="22222222-2222-4222-8222-222222222222",asOfDate="2026-08-12T12:00:00.000Z";
const league={id:leagueId,name:"Reddit Phanatics",team_count:10,scoring_type:"H2H Points",settings:{lineupSlots:{C:1,MI:1,OF:5},rosterLimits:{active:33,reserve:14},minorLeagueLimit:17,currentPeriod:19}};
const player={id:playerId,league_id:leagueId,name:"Fixture Player",mlbam_id:123,fantrax_id:"*fx*",fantrax_api_player_id:"fx",age:24,positions:["2B","SS"],mlb_team:"MIL",owner_team_id:"team-1",roster_status:"ACTIVE",is_free_agent:false,hkb_value:2500,overall_rank:55,position_rank:8,is_minor_leaguer:false};
const metric={id:"metric-1",league_id:leagueId,player_id:playerId,source:"Statcast",season:2026,metric_type:"statcast_hitting",imported_at:"2026-08-12T11:00:00.000Z",metrics:{pa:400,xba:.281,xslg:.470,xwoba:.365,barrelRate:10.2,hardHitRate:44.5,averageExitVelocity:90.4,maxExitVelocity:112.2,launchAngle:14.1,sweetSpotRate:35.2,sprintSpeed:28.1,_statcast:{fetchedAt:"2026-08-12T11:00:00.000Z",snapshotId:"snap-1"}}};

const input=buildCanonicalPlayerIntelligenceInput({player,league,metricRows:[metric],season:2026,asOfDate});
assert.equal(input.inputVersion,PLAYER_INTELLIGENCE_INPUT_VERSION);assert.equal(input.playerId,playerId);assert.equal(input.player.id,playerId);assert.equal(input.player.mlbamId,123);assert.deepEqual(input.positionEligibility.eligible,["2B","SS"]);assert.equal(input.leagueContext.teamCount,10);assert.equal(input.leagueContext.currentPeriod,19);
assert.equal(input.underlyingSkill.metrics.xwoba,.365);assert.equal(input.underlyingSkill.metrics.hardHitRate,44.5);assert.equal(input.underlyingSkill.status,INPUT_AVAILABILITY.AVAILABLE);assert.equal(input.market.value,2500);assert.equal(input.market.provider,"HKB");assert.equal(input.production.fantasyPoints,null,"missing Fantrax player production is not invented");
assert.equal(input.role.everydayRole,null);assert.equal(input.ageDevelopment.age,24);assert.equal(input.prospectContext.classification,null,"PROTECTED/INVESTMENT/CHURN is deferred");

const legacy=buildCanonicalPlayerIntelligenceInput({player,league,metricRows:[{...metric,metrics:{x_woba:.365,hard_hit_percent:44.5,barrel_batted_rate:10.2,avg_exit_velocity:90.4}}],season:2026,asOfDate});
assert.deepEqual(legacy.underlyingSkill.metrics,{xwoba:.365,barrelRate:10.2,hardHitRate:44.5,averageExitVelocity:90.4});
const pitcherPlayer={...player,positions:["SP","RP"]},pitcherMetric={...metric,metric_type:"statcast_pitching",metrics:{xera:3.2,xwobaAllowed:.29,hardHitRateAllowed:33}};
const pitcherInput=buildCanonicalPlayerIntelligenceInput({player:pitcherPlayer,league,metricRows:[metric,pitcherMetric],season:2026,asOfDate});assert.equal(pitcherInput.underlyingSkill.playerType,"pitcher");assert.equal(pitcherInput.underlyingSkill.metrics.xera,3.2);assert.equal(pitcherInput.underlyingSkill.metrics.xwoba,undefined,"hitter rows cannot bleed into pitcher inputs");

const missing=buildCanonicalPlayerIntelligenceInput({player:{...player,hkb_value:null},league,metricRows:[],season:2026,asOfDate});assert.equal(missing.underlyingSkill.status,INPUT_AVAILABILITY.MISSING);assert.deepEqual(missing.underlyingSkill.metrics,{});assert.equal(missing.market.status,INPUT_AVAILABILITY.MISSING);assert.equal(missing.market.value,null);assert.ok(missing.warnings.some(row=>row.code==="STATCAST_MISSING"));assert.ok(missing.warnings.some(row=>row.code==="HKB_MISSING"));
const stale=buildCanonicalPlayerIntelligenceInput({player,league,metricRows:[{...metric,imported_at:"2026-07-01T00:00:00Z",metrics:{...metric.metrics,_statcast:{fetchedAt:"2026-07-01T00:00:00Z"}}}],season:2026,asOfDate});assert.equal(stale.underlyingSkill.status,INPUT_AVAILABILITY.STALE);assert.ok(stale.warnings.some(row=>row.code==="STATCAST_STALE"));
assert.throws(()=>buildCanonicalPlayerIntelligenceInput({player:{...player,league_id:"other"},league,season:2026}),/do not match/);

const loaded=await loadCanonicalPlayerIntelligenceInput({leagueId,playerId,season:2026,asOfDate,repositories:{players:{allPlayers:async()=>[player]},metrics:{listMetrics:async()=>[metric]},leagues:{leagueById:async()=>league}}}),schemaAbsentInput=buildCanonicalPlayerIntelligenceInput({player:{...player,prospectLevelSchemaState:"SCHEMA_ABSENT"},league,metricRows:[metric],season:2026,asOfDate});assert.deepEqual(loaded,schemaAbsentInput,"repository-backed load attaches by UUID and carries factual schema absence");
await assert.rejects(loadCanonicalPlayerIntelligenceInput({leagueId,playerId:"missing",season:2026,repositories:{players:{allPlayers:async()=>[player]},metrics:{listMetrics:async()=>[metric]},leagues:{leagueById:async()=>league}}}),/UUID was not found/);

const insufficient=componentResult();assert.equal(insufficient.status,COMPONENT_STATUS.INSUFFICIENT_DATA);assert.equal(insufficient.score,null);assert.equal(insufficient.confidence,null);assert.throws(()=>componentResult({status:COMPONENT_STATUS.STALE,score:0}),/remain null/);
const fact=explanation({code:"MULTI_POSITION",message:"Eligible at 2B and SS",data:{positions:["2B","SS"]},source:"players.positions",confidenceImpact:0});assert.equal(fact.code,"MULTI_POSITION");
const scenarios=scenarioContract();assert.deepEqual(Object.keys(scenarios),["floor","expected","ceiling","confidence"]);assert.equal(scenarios.expected.score,null);
const foundation=buildPlayerIntelligenceFoundation(input);assert.deepEqual(Object.keys(foundation.components),COMPONENT_CODES);assert.ok(Object.values(foundation.components).every(row=>row.status===COMPONENT_STATUS.INSUFFICIENT_DATA&&row.score===null));assert.equal(foundation.compatibility.productionCalculationChanged,false);

const legacyScores=calculatePlayerScores({player,metrics:metric.metrics,leagueSettings:league.settings});assert.equal(ENGINE_VERSION,"5.1.1");assert.equal(legacyScores.overall_score_version,"5.1.1");
const serviceSource=await readFile(new URL("../v5/js/services/playerIntelligenceInputService.js",import.meta.url),"utf8"),foundationSource=await readFile(new URL("../v5/js/engine/playerIntelligenceFoundation.js",import.meta.url),"utf8");
assert.doesNotMatch(serviceSource,/\.from\(|upsert|insert\(|update\(|delete\(/,"foundation performs no database writes");assert.doesNotMatch(foundationSource,/repositories|supabase|fetch\(/,"components consume assembled canonical input only");
console.log("v5PlayerIntelligenceFoundation tests passed");
