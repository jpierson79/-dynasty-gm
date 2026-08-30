import assert from "node:assert/strict";
import {ARCHETYPES,classifyPlayerArchetype} from "../v5/js/engine/playerIntelligenceComposite.js";

function fixture({age=28,minor=false,level="MLB",availability="AVAILABLE",mlbStatus=level==="MLB"?"MLB":minor===true?"MINORS":"UNKNOWN",position="SS",transition=null}={}){
  return {input:{schema:"player-intelligence-input-v1",playerId:"00000000-0000-4000-8000-000000000001",leagueId:"league",player:{id:"00000000-0000-4000-8000-000000000001",mlbamId:123,age,isMinorLeaguer:minor},positionEligibility:{eligible:Array.isArray(position)?position:[position]},role:{mlbStatus},ageDevelopment:{level,levelAvailability:availability},prospectContext:{isProspect:minor,level,levelAvailability:availability}},evidence:{recentTransition:transition}};
}

const cases=[
  ["established MLB veteran",{age:35},ARCHETYPES.MLB_VETERAN],
  ["young factual MLB player",{age:23},ARCHETYPES.YOUNG_MLB_OR_RECENT_CALLUP],
  ["actual recent call-up",{age:27,transition:"PROMOTED"},ARCHETYPES.YOUNG_MLB_OR_RECENT_CALLUP],
  ["AAA minor leaguer",{age:22,minor:true,level:"AAA"},ARCHETYPES.NEAR_MLB_PROSPECT],
  ["AA minor leaguer",{age:22,minor:true,level:"AA"},ARCHETYPES.NEAR_MLB_PROSPECT],
  ["A+ minor leaguer",{age:21,minor:true,level:"A_PLUS"},ARCHETYPES.DISTANT_PROSPECT],
  ["A minor leaguer",{age:19,minor:true,level:"A"},ARCHETYPES.DISTANT_PROSPECT],
  ["Rookie minor leaguer",{age:19,minor:true,level:"ROOKIE"},ARCHETYPES.DISTANT_PROSPECT],
  ["Complex minor leaguer",{age:19,minor:true,level:"COMPLEX"},ARCHETYPES.DISTANT_PROSPECT],
  ["DSL minor leaguer",{age:18,minor:true,level:"DSL"},ARCHETYPES.DISTANT_PROSPECT],
  ["conflicting level evidence",{age:20,minor:true,level:null,availability:"CONFLICT"},ARCHETYPES.CONSERVATIVE_UNKNOWN,"ARCHETYPE_LEVEL_CONFLICT"],
  ["unknown evidence",{age:20,minor:null,level:"UNKNOWN",availability:"UNKNOWN",mlbStatus:"UNKNOWN"},ARCHETYPES.CONSERVATIVE_UNKNOWN,"ARCHETYPE_STATUS_UNKNOWN"],
  ["minor flag with MLB level",{age:20,minor:true,level:"MLB",mlbStatus:"MLB"},ARCHETYPES.CONSERVATIVE_UNKNOWN,"ARCHETYPE_CONTEXT_CONTRADICTION"],
  ["MLB flag with minor level",{age:20,minor:false,level:"AA",mlbStatus:"MLB"},ARCHETYPES.CONSERVATIVE_UNKNOWN,"ARCHETYPE_CONTEXT_CONTRADICTION"],
  ["missing age with valid AAA",{age:null,minor:true,level:"AAA"},ARCHETYPES.NEAR_MLB_PROSPECT],
  ["young A ball remains distant",{age:19,minor:true,level:"A"},ARCHETYPES.DISTANT_PROSPECT],
  ["older AAA remains near",{age:26,minor:true,level:"AAA"},ARCHETYPES.NEAR_MLB_PROSPECT],
  ["missing level with factual MLB status",{age:28,minor:false,level:null,availability:"UNKNOWN",mlbStatus:"MLB"},ARCHETYPES.MLB_HITTER],
  ["inactive player",{age:20,minor:true,level:"INACTIVE"},ARCHETYPES.CONSERVATIVE_UNKNOWN,"ARCHETYPE_INACTIVE"],
  ["schema unavailable",{age:20,minor:null,level:null,availability:"SCHEMA_ABSENT",mlbStatus:"UNKNOWN"},ARCHETYPES.CONSERVATIVE_UNKNOWN,"ARCHETYPE_STATUS_UNKNOWN"],
  ["two-way conflict still fails closed",{age:20,minor:null,level:null,availability:"CONFLICT",mlbStatus:"UNKNOWN",position:["SP","OF"]},ARCHETYPES.CONSERVATIVE_UNKNOWN,"ARCHETYPE_LEVEL_CONFLICT"],
  ["two-way minor still follows factual level",{age:20,minor:true,level:"AAA",position:["SP","OF"]},ARCHETYPES.NEAR_MLB_PROSPECT]
];

for(const [name,values,expected,warning] of cases){
  const {input,evidence}=fixture(values),before=structuredClone(input),result=classifyPlayerArchetype(input,evidence);
  assert.equal(result.archetype,expected,name);
  if(warning)assert.ok(result.warnings.includes(warning),`${name} exposes ${warning}`);
  assert.deepEqual(input,before,`${name} does not mutate canonical input`);
}

const mixed=cases.map(([,values])=>{const {input,evidence}=fixture(values);return classifyPlayerArchetype(input,evidence).archetype}),mixedCounts=Object.fromEntries([...new Set(mixed)].sort().map(group=>[group,mixed.filter(value=>value===group).length]));
for(const group of [ARCHETYPES.MLB_VETERAN,ARCHETYPES.YOUNG_MLB_OR_RECENT_CALLUP,ARCHETYPES.NEAR_MLB_PROSPECT,ARCHETYPES.DISTANT_PROSPECT,ARCHETYPES.CONSERVATIVE_UNKNOWN])assert.ok(mixed.includes(group),`mixed population includes ${group}`);

const youngMinors=Array.from({length:1000},(_,index)=>fixture({age:18+index%7,minor:true,level:index%2?"A":"AAA"}));
const distribution=youngMinors.map(({input,evidence})=>classifyPlayerArchetype(input,evidence).archetype);
assert.equal(distribution.filter(group=>group===ARCHETYPES.YOUNG_MLB_OR_RECENT_CALLUP).length,0,"young factual minor leaguers cannot collapse into the young MLB branch");
assert.equal(distribution.filter(group=>group===ARCHETYPES.NEAR_MLB_PROSPECT).length,500);
assert.equal(distribution.filter(group=>group===ARCHETYPES.DISTANT_PROSPECT).length,500);

console.log(`v5PlayerIntelligenceArchetypeClassification tests passed (${cases.length} fixtures; mixed=${JSON.stringify(mixedCounts)}; synthetic near=500 distant=500 youngMLB=0)`);
