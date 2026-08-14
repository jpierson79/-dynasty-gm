import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {renderPlayerIntelligenceInspection} from "../v5/js/views/playerIntelligenceInspectionView.js";

const count=10326;
const component=(code)=>({component:code,compositeScore:60,confidence:80,baseWeight:10,effectiveWeight:8,normalizedWeight:12.5,contribution:7.5,applicability:"REQUIRED"});
const players=Array.from({length:count},(_,index)=>({
  playerId:`00000000-0000-4000-8000-${String(index).padStart(12,"0")}`,
  identity:{name:`Synthetic Player ${index}`,fantraxId:`fx-${index}`,mlbamId:600000+index,organization:"ORG",eligibility:[index%7===0?"SP":"OF"]},
  availability:index%3===0?"FREE_AGENT":"ROSTERED",archetype:index%7===0?"MLB_STARTING_PITCHER":"MLB_HITTER",archetypeConfidence:80,
  expected:60,floor:45,ceiling:75,overallConfidence:80,
  components:Object.fromEntries(["leagueProduction","underlyingSkill","replacementAdvantage","positionalScarcityValue","roleStability","ageTrajectory","risk","prospectOpportunityCost"].map(code=>[code,component(code)])),
  market:{rawHkb:100,percentile:50,divergence:"ALIGNED_WITH_MARKET",signedGap:10},strongestPositiveContributors:[],strongestNegativeContributors:[],warnings:[],missingRequiredEvidence:[],staleEvidence:[],missingStatcast:false,rawReplacementGap:20,groups:[],diagnosticFlags:[]
}));
const groups=Object.fromEntries(["ELITE_MLB_HITTERS","MIDDLE_INFIELDERS","OUTFIELDERS","CATCHERS","STARTING_PITCHERS","RELIEVERS_CLOSERS","YOUNG_MLB_PLAYERS","AGING_PRODUCTIVE_VETERANS","NEAR_MLB_PROSPECTS","DISTANT_PROSPECTS","FREE_AGENTS","BELOW_REPLACEMENT_ROSTERED"].map(code=>[code,{count:0,medianExpected:null,medianConfidence:null,percentageMissingStatcast:0,medianContributionShares:{}}]));
const inspection={players,calibrationDecision:"REAL_PLAYER_ACCEPTANCE_REQUIRED",diagnostics:{flags:[],byGroup:groups,byArchetype:{MLB_HITTER:{count}}}};
const before=process.memoryUsage().heapUsed,start=performance.now();
const html=renderPlayerIntelligenceInspection({authUser:{id:"user"},activeLeague:{id:"league",name:"Reddit Phanatics"},playerIntelligenceInspection:{status:"READY",result:{inspection},rows:players,filters:{},ranking:"expected"}});
const durationMs=Math.round(performance.now()-start),heapDeltaMb=Math.round((process.memoryUsage().heapUsed-before)/1048576),rowElements=(html.match(/<tr>/g)||[]).length,options=(html.match(/<option/g)||[]).length;
assert.ok(options>=count*2,"full population is eagerly rendered into both comparison selects");
assert.equal(rowElements,10340,"full population table and diagnostic rows are eagerly rendered");
assert.ok(html.length>5_000_000,"the full-population view eagerly creates a very large HTML payload");
console.log(JSON.stringify({diagnostic:"V5.5B-6B",players:count,renderDurationMs:durationMs,heapDeltaMb,htmlBytes:html.length,rowElements,optionElements:options}));
