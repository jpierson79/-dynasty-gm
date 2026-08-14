import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildPlayerIntelligenceInspection,compareInspectionPlayers,filterInspectionPlayers,INSPECTION_GROUPS,loadPlayerIntelligenceInspection,rankInspectionPlayers} from "../v5/js/services/playerIntelligenceInspectionService.js";
import {ENGINE_VERSION} from "../v5/js/engine/dynastyEngine.js";

const L="league";
const input=(id,{name=`Player ${id}`,age=28,minor=false,pos=["1B"],free=false,owner="team",statcast="AVAILABLE",hkb=500}={})=>({schema:"player-intelligence-input-v1",playerId:id,leagueId:L,player:{name,age,isMinorLeaguer:minor,fantraxId:`*${id}*`,mlbamId:Number(id.replace(/\D/g,""))||null,organization:"ORG",rosterStatus:free?"FREE_AGENT":"ACTIVE",ownerTeamId:free?null:owner,isFreeAgent:free},positionEligibility:{eligible:pos},underlyingSkill:{status:statcast},market:{value:hkb}});
const contribution=(component,score,normalizedWeight=12,confidence=90)=>({component,compositeScore:score,rawScore:component==="risk"?100-score:score,confidence,applicability:"REQUIRED",baseWeight:normalizedWeight,effectiveWeight:normalizedWeight,normalizedWeight,contribution:score*normalizedWeight/100});
const composite=(id,archetype,{expected=70,confidence=80,missingSkill=false,market=55,weights={}}={})=>{const codes=["leagueProduction","underlyingSkill","replacementAdvantage","positionalScarcityValue","roleStability","ageTrajectory","risk","prospectOpportunityCost","marketSupport"],rows=codes.filter(code=>!(missingSkill&&code==="underlyingSkill")).map(code=>contribution(code,code==="risk"?75:70,weights[code]??(code==="marketSupport"?8:12)));return {playerId:id,leagueId:L,archetype,overallPlayerIntelligence:{score:expected,confidence},floor:expected-10,expected,ceiling:expected+10,componentContributions:rows,strengths:[{component:"leagueProduction",contribution:12}],risks:missingSkill?[{code:"MISSING_REQUIRED_COMPONENT",component:"underlyingSkill"}]:[],warnings:missingSkill?["MISSING_REQUIRED_UNDERLYING_SKILL"]:[],market:{normalizedMarketValue:market,divergence:"ALIGNED_WITH_MARKET",gap:expected-market},dataCoverage:{missingComponents:missingSkill?["underlyingSkill"]:[],staleComponents:[]}}};
const result=(id,{production=75,gap=20}={})=>({playerId:id,components:{leagueProduction:{score:production},replacementAdvantage:{explanations:[{data:{rawReplacementGap:gap}}]}},replacementContext:{rawReplacementGap:gap}});

const fixtures=[
  [input("1",{pos:["SS"]}),composite("1","MLB_HITTER",{expected:91}),result("1",{production:95})],
  [input("2",{pos:["2B"]}),composite("2","MLB_HITTER"),result("2")],
  [input("3",{pos:["OF"]}),composite("3","MLB_HITTER"),result("3")],
  [input("4",{pos:["C"]}),composite("4","MLB_HITTER"),result("4")],
  [input("5",{pos:["SP"]}),composite("5","MLB_STARTING_PITCHER"),result("5")],
  [input("6",{pos:["RP"]}),composite("6","MLB_RELIEVER",{weights:{leagueProduction:27,roleStability:18}}),result("6")],
  [input("7",{age:23,pos:["OF"]}),composite("7","YOUNG_MLB_OR_RECENT_CALLUP"),result("7")],
  [input("8",{age:35,pos:["1B"]}),composite("8","MLB_VETERAN"),result("8",{production:80})],
  [input("9",{age:21,minor:true,pos:["SS"]}),composite("9","NEAR_MLB_PROSPECT"),result("9",{production:null,gap:null})],
  [input("10",{age:19,minor:true,pos:["OF"]}),composite("10","DISTANT_PROSPECT",{weights:{ageTrajectory:20,prospectOpportunityCost:34,marketSupport:8}}),result("10",{production:null,gap:null})],
  [input("11",{pos:["OF"],free:true}),composite("11","MLB_HITTER",{missingSkill:true,confidence:55}),result("11",{gap:30})],
  [input("12",{pos:["1B"]}),composite("12","MLB_HITTER",{expected:45}),result("12",{gap:-25})]
];
const inspection=buildPlayerIntelligenceInspection({inputs:fixtures.map(x=>x[0]),composites:fixtures.map(x=>x[1]),componentResults:fixtures.map(x=>x[2])});
assert.equal(inspection.players.length,12);for(const group of Object.values(INSPECTION_GROUPS))assert.ok(inspection.players.some(row=>row.groups.includes(group)),`group ${group} is represented`);
assert.equal(rankInspectionPlayers(inspection,{dimension:"expected"})[0].playerId,"1");assert.equal(rankInspectionPlayers(inspection,{dimension:"confidence"})[0].overallConfidence,80);assert.ok(num(rankInspectionPlayers(inspection,{dimension:"leagueProduction"})[0].components.leagueProduction.compositeScore));
assert.equal(filterInspectionPlayers(inspection,{archetype:"MLB_RELIEVER"})[0].playerId,"6");assert.equal(filterInspectionPlayers(inspection,{position:"C"})[0].playerId,"4");assert.equal(filterInspectionPlayers(inspection,{availability:"FREE_AGENT",missingStatcast:true})[0].playerId,"11");
const pair=compareInspectionPlayers(inspection,"1","12");assert.equal(pair.expectedDifference,46);assert.equal(pair.floorDifference,46);assert.equal(pair.ceilingDifference,46);assert.equal(pair.marketPercentileDifference,0);assert.equal(pair.marketDivergenceDifference,46);assert.ok(pair.componentDifferences.length);assert.ok(Array.isArray(pair.topReasonsA)&&Array.isArray(pair.topReasonsB));
assert.equal(inspection.diagnostics.byArchetype.MLB_HITTER.count,6);assert.equal(inspection.diagnostics.byGroup.FREE_AGENTS.count,1);assert.ok(inspection.diagnostics.byArchetype.MLB_RELIEVER.medianContributionShares.leagueProduction>=27);assert.equal(inspection.diagnostics.byGroup.FREE_AGENTS.percentageMissingStatcast,100);
assert.ok(inspection.diagnostics.flags.some(row=>row.code==="AVAILABLE_ABOVE_REPLACEMENT"&&row.playerId==="11"));assert.ok(inspection.diagnostics.flags.some(row=>row.code==="ROSTERED_BELOW_REPLACEMENT"&&row.playerId==="12"));assert.ok(inspection.diagnostics.flags.some(row=>row.code==="ROLE_PRODUCTION_OVERLAP"));assert.ok(inspection.diagnostics.flags.some(row=>row.code==="AGE_PROSPECT_OVERLAP"));
assert.equal(inspection.players.find(row=>row.playerId==="11").expected,70,"diagnostics never mutate scores");assert.equal(inspection.players.find(row=>row.playerId==="11").overallConfidence,55,"missing Statcast remains a confidence signal");assert.equal(inspection.calibrationDecision,"REAL_PLAYER_ACCEPTANCE_REQUIRED");
assert.equal(inspection.players.find(row=>row.playerId==="6").archetype,"MLB_RELIEVER");assert.ok(inspection.diagnostics.byGroup.RELIEVERS_CLOSERS.medianLeagueProduction!==null);assert.ok(inspection.diagnostics.byGroup.MIDDLE_INFIELDERS.count>=2);assert.ok(inspection.diagnostics.byGroup.NEAR_MLB_PROSPECTS.medianContributionShares.marketSupport<=8);assert.ok(inspection.diagnostics.byGroup.AGING_PRODUCTIVE_VETERANS.medianExpected>0);
let calls=0;const map=new Map(fixtures.map(row=>[row[0].playerId,row[0]]));const loaded=await loadPlayerIntelligenceInspection({leagueId:L},{loadComposite:async()=>{calls++;return {prior:{prior:{production:{context:{inputsById:map}}},context:{players:fixtures.map(x=>x[2])}},composite:fixtures.map(x=>x[1])}}});assert.equal(calls,1,"inspection invokes the canonical population loader once");assert.equal(loaded.inspection.players.length,12);
const source=await readFile(new URL("../v5/js/services/playerIntelligenceInspectionService.js",import.meta.url),"utf8");assert.doesNotMatch(source,/player\.name\s*===|Sal Stewart|Brice Turang|Bryan Baker|Juan Soto|Acu/);assert.doesNotMatch(source,/insert\(|update\(|upsert|delete\(|calculated_player_scores|\.from\(/);assert.match(source,/loadPlayerIntelligenceComposite/);assert.equal(ENGINE_VERSION,"5.1.1");
function num(value){return typeof value==="number"&&Number.isFinite(value)}
console.log("v5PlayerIntelligenceInspection tests passed");
