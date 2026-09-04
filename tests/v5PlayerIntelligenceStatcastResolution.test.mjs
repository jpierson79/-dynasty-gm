import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {performance} from "node:perf_hooks";
import {evaluateUnderlyingSkill,buildUnderlyingSkillContext,MATERIAL_GAP_THRESHOLD} from "../v5/js/engine/playerIntelligenceUnderlyingSkill.js";
import {HITTER_WEIGHTS,PITCHER_WEIGHTS} from "../v5/js/engine/playerIntelligenceUnderlyingSkill.js";
import {classifyPlayerArchetype} from "../v5/js/engine/playerIntelligenceComposite.js";
import {resolveStatcastRows} from "../v5/js/services/statcastProviderService.js";
import {buildCanonicalPlayerIntelligenceInput,buildPlayerMetricIndex} from "../v5/js/services/playerIntelligenceInputService.js";

const league={id:"11111111-1111-4111-8111-111111111111",name:"Reddit Phanatics",settings:{currentSeason:2026}};
const player={id:"22222222-2222-4222-8222-222222222222",league_id:league.id,name:"Canonical Hitter",mlbam_id:123456,positions:["OF"],is_minor_leaguer:false};
const statcast={id:"statcast",league_id:league.id,player_id:player.id,source:"Statcast",season:2026,metric_type:"statcast_hitting",imported_at:"2026-08-20T00:00:00.000Z",metrics:{xwoba:.375,_statcast:{fetchedAt:"2026-08-20T00:00:00.000Z"}}};
const wrongSourceCollision={id:"wrong-source",league_id:league.id,player_id:player.id,source:"Fantrax",season:2026,metric_type:"statcast_hitting",imported_at:"2026-08-21T00:00:00.000Z",metrics:{}};

const metricsByPlayerId=buildPlayerMetricIndex([statcast,wrongSourceCollision],2026);
const input=buildCanonicalPlayerIntelligenceInput({player,league,metricsByPlayerId,season:2026,asOfDate:"2026-08-21T01:00:00.000Z"});
assert.equal(input.underlyingSkill.source,"Statcast","a wrong-source/type collision cannot hide canonical Statcast evidence");
assert.equal(input.underlyingSkill.metrics.xwoba,.375,"valid canonical Statcast evidence remains resolvable through the population index");

const hitterMetrics={pa:500,xba:.291,xslg:.510,xwoba:.380,barrelRate:14,hardHitRate:49,averageExitVelocity:91.5,maxExitVelocity:113,launchAngle:14,sweetSpotRate:38,sprintSpeed:28.5};
const pitcherMetrics={pa:550,era:3.1,xera:3.3,xwobaAllowed:.285,barrelRateAllowed:6,hardHitRateAllowed:34,averageExitVelocityAllowed:87.5};
function row(id,type,metrics,overrides={}){return {id,league_id:league.id,player_id:overrides.player_id??player.id,source:overrides.source??"Statcast",season:overrides.season??2026,metric_type:type,imported_at:overrides.imported_at??"2026-08-21T00:00:00.000Z",metrics:{...metrics,_statcast:{fetchedAt:"2026-08-21T00:00:00.000Z"}}}}
function canonical(subject,rows){return buildCanonicalPlayerIntelligenceInput({player:subject,league,metricsByPlayerId:buildPlayerMetricIndex(rows,2026),season:2026,asOfDate:"2026-08-21T01:00:00.000Z"})}
function canonicalSingle(subject,rows){return buildCanonicalPlayerIntelligenceInput({player:subject,league,metricRows:rows,season:2026,asOfDate:"2026-08-21T01:00:00.000Z"})}

const completeHitter=canonical(player,[row("hitter-complete","statcast_hitting",hitterMetrics)]);
assert.deepEqual(completeHitter.underlyingSkill.metrics,hitterMetrics);
assert.equal(completeHitter.underlyingSkill.status,"AVAILABLE");
const partialHitterPlayer={...player,id:"77777777-7777-4777-8777-777777777777"},partialHitter=canonical(partialHitterPlayer,[row("hitter-partial","statcast_hitting",{xwoba:.360,barrelRate:12,hardHitRate:45,invalid:null},{player_id:partialHitterPlayer.id})]);
assert.deepEqual(partialHitter.underlyingSkill.metrics,{xwoba:.360,barrelRate:12,hardHitRate:45});
assert.ok(!Object.values(partialHitter.underlyingSkill.metrics).includes(0),"missing metrics are excluded instead of zero-filled");
const missingHitter=canonical(player,[]);
assert.equal(missingHitter.underlyingSkill.status,"MISSING");assert.deepEqual(missingHitter.underlyingSkill.metrics,{});

const pitcher={...player,id:"33333333-3333-4333-8333-333333333333",name:"Canonical Pitcher",positions:["SP"]};
const completePitcher=canonical(pitcher,[row("pitcher-complete","statcast_pitching",pitcherMetrics,{player_id:pitcher.id})]);
assert.deepEqual(completePitcher.underlyingSkill.metrics,pitcherMetrics);assert.equal(completePitcher.underlyingSkill.status,"AVAILABLE");
const partialPitcherPlayer={...pitcher,id:"88888888-8888-4888-8888-888888888888"},partialPitcher=canonical(partialPitcherPlayer,[row("pitcher-partial","statcast_pitching",{xera:3.4,xwobaAllowed:.290},{player_id:partialPitcherPlayer.id})]);
assert.deepEqual(partialPitcher.underlyingSkill.metrics,{xera:3.4,xwobaAllowed:.290});
const missingPitcher=canonical(pitcher,[]);assert.equal(missingPitcher.underlyingSkill.status,"MISSING");assert.deepEqual(missingPitcher.underlyingSkill.metrics,{});

const identityMismatch=canonical(player,[row("other-player","statcast_hitting",hitterMetrics,{player_id:"44444444-4444-4444-8444-444444444444"})]);
assert.equal(identityMismatch.underlyingSkill.status,"MISSING","wrong UUID does not resolve");
assert.equal(canonical({...player,name:"Renamed Player"},[row("uuid-only","statcast_hitting",hitterMetrics)]).underlyingSkill.metrics.xwoba,.380,"names are not part of canonical metric association");
const providerIdentity=resolveStatcastRows({rows:[{mlbamId:"123456",metrics:hitterMetrics}]},[player]);
assert.equal(providerIdentity.matched.length,1,"provider identity normalizes exact MLBAM string/number representation");
assert.equal(providerIdentity.matched[0].player.id,player.id,"provider identity resolves to the stable UUID before persistence");
assert.equal(resolveStatcastRows({rows:[{mlbamId:"999999",metrics:hitterMetrics}]},[player]).unmatched.length,1,"wrong MLBAM does not resolve");

const separated=buildPlayerMetricIndex([
  row("hit","statcast_hitting",hitterMetrics),
  row("pitch","statcast_pitching",pitcherMetrics),
  row("production","fantrax_league_production",{fantasyPoints:321,fantasyPointsPerGame:4.2},{source:"Fantrax"}),
  row("wrong-hit-source","statcast_hitting",{}, {source:"Fantrax",imported_at:"2026-08-22T00:00:00.000Z"}),
  row("wrong-pitch-source","statcast_pitching",{}, {source:"Fantrax",imported_at:"2026-08-22T00:00:00.000Z"}),
  row("wrong-production-source","fantrax_league_production",{fantasyPoints:999},{source:"Statcast",imported_at:"2026-08-22T00:00:00.000Z"})
],2026);
assert.equal(separated.get(player.id).statcast_hitting.id,"hit");assert.equal(separated.get(player.id).statcast_pitching.id,"pitch");assert.equal(separated.get(player.id).fantrax_league_production.id,"production");
assert.equal(canonical(player,[row("pitch-only","statcast_pitching",pitcherMetrics)]).underlyingSkill.status,"MISSING","hitters cannot consume pitcher evidence");
assert.equal(canonical(pitcher,[row("hit-only","statcast_hitting",hitterMetrics,{player_id:pitcher.id})]).underlyingSkill.status,"MISSING","pitchers cannot consume hitter evidence");

const hitterParityRows=[
  row("parity-hit","statcast_hitting",hitterMetrics),
  row("parity-production","fantrax_league_production",{fantasyPoints:321,fantasyPointsPerGame:4.2},{source:"Fantrax"}),
  row("parity-wrong-hit","statcast_hitting",{}, {source:"Fantrax",imported_at:"2026-08-22T00:00:00.000Z"}),
  row("parity-wrong-production","fantrax_league_production",{fantasyPoints:999},{source:"Statcast",imported_at:"2026-08-22T00:00:00.000Z"})
],hitterSingle=canonicalSingle(player,hitterParityRows),hitterIndexed=canonical(player,hitterParityRows);
assert.deepEqual(hitterIndexed.underlyingSkill,hitterSingle.underlyingSkill,"indexed hitter selection matches the canonical single-player source/type contract");
assert.deepEqual(hitterIndexed.production,hitterSingle.production,"indexed Fantrax production selection matches the canonical single-player source/type contract");
const pitcherParityRows=[
  row("parity-pitch","statcast_pitching",pitcherMetrics,{player_id:pitcher.id}),
  row("parity-wrong-pitch","statcast_pitching",{}, {player_id:pitcher.id,source:"Fantrax",imported_at:"2026-08-22T00:00:00.000Z"})
],pitcherSingle=canonicalSingle(pitcher,pitcherParityRows),pitcherIndexed=canonical(pitcher,pitcherParityRows);
assert.deepEqual(pitcherIndexed.underlyingSkill,pitcherSingle.underlyingSkill,"indexed pitcher selection matches the canonical single-player source/type contract");

const twoWay={...player,id:"55555555-5555-4555-8555-555555555555",positions:["OF","SP"]},twoWayIndex=buildPlayerMetricIndex([
  row("two-way-hit","statcast_hitting",hitterMetrics,{player_id:twoWay.id}),row("two-way-pitch","statcast_pitching",pitcherMetrics,{player_id:twoWay.id})
],2026),twoWayInput=buildCanonicalPlayerIntelligenceInput({player:twoWay,league,metricsByPlayerId:twoWayIndex,season:2026,asOfDate:"2026-08-21T01:00:00.000Z"});
assert.ok(twoWayIndex.get(twoWay.id).statcast_hitting&&twoWayIndex.get(twoWay.id).statcast_pitching,"both namespaces remain separately addressable");
assert.equal(twoWayInput.underlyingSkill.playerType,"pitcher","existing two-way input policy remains pitcher-first");

const legacyKeys=canonical(player,[row("legacy","statcast_hitting",{x_woba:.355,x_slg:.470,x_ba:.275,barrel_batted_rate:10,hard_hit_percent:42,avg_exit_velocity:89.5})]);
assert.deepEqual(legacyKeys.underlyingSkill.metrics,{xba:.275,xslg:.470,xwoba:.355,barrelRate:10,hardHitRate:42,averageExitVelocity:89.5});
const duplicateIndex=buildPlayerMetricIndex([row("new","statcast_hitting",{xwoba:.390}),row("old","statcast_hitting",{xwoba:.300},{imported_at:"2026-08-19T00:00:00.000Z"})],2026);
assert.equal(duplicateIndex.get(player.id).statcast_hitting.id,"new","newest exact source/type duplicate wins deterministically");
assert.equal(canonical(player,[row("old-season","statcast_hitting",hitterMetrics,{season:2025})]).underlyingSkill.status,"MISSING","wrong-season evidence remains excluded");

const skillInputs=[completeHitter,partialHitter,completePitcher,partialPitcher],skillContext=buildUnderlyingSkillContext(skillInputs);
const completeHitterSkill=evaluateUnderlyingSkill(skillContext,completeHitter.playerId),partialHitterSkill=evaluateUnderlyingSkill(skillContext,partialHitter.playerId);
assert.equal(completeHitterSkill.evidence.metricsUsed.length,Object.keys(HITTER_WEIGHTS).length);assert.equal(completeHitterSkill.component.confidence,90);
assert.equal(partialHitterSkill.evidence.metricsUsed.length,3);assert.equal(partialHitterSkill.component.confidence,39,"existing hitter confidence formula remains unchanged");
const completePitcherSkill=evaluateUnderlyingSkill(skillContext,completePitcher.playerId),partialPitcherSkill=evaluateUnderlyingSkill(skillContext,partialPitcher.playerId);
assert.equal(completePitcherSkill.evidence.metricsUsed.length,Object.keys(PITCHER_WEIGHTS).length);assert.equal(completePitcherSkill.component.confidence,80);
assert.equal(partialPitcherSkill.evidence.metricsUsed.length,2);assert.equal(partialPitcherSkill.component.confidence,26,"existing pitcher confidence formula remains unchanged");
const minorMissing=canonical({...player,id:"66666666-6666-4666-8666-666666666666",is_minor_leaguer:true,current_level:"A",level_availability:"AVAILABLE"},[]);
assert.equal(evaluateUnderlyingSkill(buildUnderlyingSkillContext([minorMissing]),minorMissing.playerId).component.status,"NOT_APPLICABLE","prospect evidence cannot proxy for absent MLB Statcast");
assert.equal(MATERIAL_GAP_THRESHOLD,20);

const archetypeFixtures=[
  [{...player,id:"arch-established",age:28,current_level:"MLB",level_availability:"AVAILABLE"},hitterMetrics],
  [{...player,id:"arch-young",age:23,current_level:"MLB",level_availability:"AVAILABLE"},hitterMetrics],
  [{...player,id:"arch-near",age:21,is_minor_leaguer:true,current_level:"AAA",level_availability:"AVAILABLE"},null],
  [{...player,id:"arch-distant",age:19,is_minor_leaguer:true,current_level:"A",level_availability:"AVAILABLE"},null],
  [{...player,id:"arch-unknown",age:null,is_minor_leaguer:null,current_level:null,level_availability:"UNKNOWN"},null]
].map(([subject,metrics])=>canonical(subject,metrics?[row(`metric-${subject.id}`,"statcast_hitting",metrics,{player_id:subject.id})]:[]));
const coverageByArchetype=Object.fromEntries(archetypeFixtures.map(subject=>{const archetype=classifyPlayerArchetype(subject).archetype;return [archetype,{available:subject.underlyingSkill.status==="AVAILABLE"?1:0,total:1}]}));
assert.deepEqual(coverageByArchetype.MLB_HITTER,{available:1,total:1});assert.deepEqual(coverageByArchetype.YOUNG_MLB_OR_RECENT_CALLUP,{available:1,total:1});
assert.deepEqual(coverageByArchetype.NEAR_MLB_PROSPECT,{available:0,total:1});assert.deepEqual(coverageByArchetype.DISTANT_PROSPECT,{available:0,total:1});assert.deepEqual(coverageByArchetype.CONSERVATIVE_UNKNOWN,{available:0,total:1});

const largePlayers=10326,largeRows=[];let expectedHitters=0,expectedPitchers=0;
for(let index=0;index<largePlayers;index++){
  const id=`large-${index}`;
  if(index%5===0)continue;
  if(index%2===0){largeRows.push(row(`large-hit-${index}`,"statcast_hitting",{xwoba:.300+index%10/1000},{player_id:id}));expectedHitters++}
  else{largeRows.push(row(`large-pitch-${index}`,"statcast_pitching",{xera:3+index%10/10},{player_id:id}));expectedPitchers++}
  largeRows.push(row(`large-wrong-${index}`,index%2===0?"statcast_hitting":"statcast_pitching",{}, {player_id:id,source:"Fantrax",imported_at:"2026-08-22T00:00:00.000Z"}));
}
const started=performance.now(),largeIndex=buildPlayerMetricIndex(largeRows,2026),elapsedMs=Math.round((performance.now()-started)*100)/100;
assert.equal([...largeIndex.values()].filter(value=>value.statcast_hitting).length,expectedHitters);assert.equal([...largeIndex.values()].filter(value=>value.statcast_pitching).length,expectedPitchers);
assert.ok(elapsedMs<2000,`one-pass 10k index took ${elapsedMs} ms`);

const inputSource=await readFile(new URL("../v5/js/services/playerIntelligenceInputService.js",import.meta.url),"utf8"),leagueServiceSource=await readFile(new URL("../v5/js/services/playerIntelligenceLeagueProductionService.js",import.meta.url),"utf8");
assert.doesNotMatch(inputSource,/normalizedName|normalized_name|player\.name\s*===/i,"Statcast resolution introduces no name matching");
assert.match(leagueServiceSource,/metricsRepo\.listMetrics\(leagueId\)/);assert.match(leagueServiceSource,/buildPlayerMetricIndex\(metricRows,season\)/);
assert.equal((leagueServiceSource.match(/metricsRepo\.listMetrics\(/g)||[]).length,1,"population evaluation loads metrics once");assert.match(leagueServiceSource,/\.map\(player=>buildCanonicalPlayerIntelligenceInput/);

console.log(`v5 Player Intelligence Statcast resolution tests passed (10k index: ${largePlayers} players, ${largeRows.length} rows, ${elapsedMs} ms; coverage=${JSON.stringify(coverageByArchetype)})`);
