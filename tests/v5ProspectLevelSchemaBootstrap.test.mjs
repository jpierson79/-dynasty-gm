import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {enrichPlayersWithProspectLevelEvidence,PLAYER_INTELLIGENCE_BASE_PLAYER_COLUMNS,PROSPECT_LEVEL_EVIDENCE_BATCH_SIZE} from "../v5/js/repositories/playerIntelligenceRepository.js";
import {buildCanonicalPlayerIntelligenceInput,loadCanonicalPlayerIntelligenceInput} from "../v5/js/services/playerIntelligenceInputService.js";
import {PROSPECT_LEVEL_SCHEMA_FIELDS,PROSPECT_LEVEL_SCHEMA_STATES,inspectProspectLevelColumnPresence,inspectProspectLevelSchemaRows,isMissingProspectLevelColumnError,withProspectLevelSchemaState} from "../v5/js/services/prospectLevelEvidence.js";

const uuid=index=>`00000000-0000-4000-8000-${String(index).padStart(12,"0")}`;
const corePlayer=(index=1)=>({id:uuid(index),league_id:"league",name:`Player ${index}`,fantrax_id:`f-${index}`,mlbam_id:1000+index,age:22,positions:["SS"],mlb_team:"SEA",owner_team_id:"team-1",roster_status:"MINORS",is_minor_leaguer:true,is_free_agent:false,hkb_value:10,teams:{id:"team-1",name:"Team",abbreviation:"T"}});
const evidence=(id,values={})=>({id,...Object.fromEntries(PROSPECT_LEVEL_SCHEMA_FIELDS.map(field=>[field,null])),...values});
const missingColumn=(field,code="42703")=>Object.assign(new Error(`column players_1.${field} does not exist`),{code});

assert.equal(inspectProspectLevelSchemaRows([corePlayer()]).schemaState,PROSPECT_LEVEL_SCHEMA_STATES.SCHEMA_ABSENT);
assert.equal(inspectProspectLevelSchemaRows([evidence(uuid(1))]).schemaState,PROSPECT_LEVEL_SCHEMA_STATES.PRESENT,"present null columns are schema-present");
assert.equal(inspectProspectLevelSchemaRows([{...corePlayer(),current_level:null}]).schemaState,PROSPECT_LEVEL_SCHEMA_STATES.PARTIAL);
assert.equal(inspectProspectLevelColumnPresence(Object.fromEntries(PROSPECT_LEVEL_SCHEMA_FIELDS.map(field=>[field,false]))).schemaState,PROSPECT_LEVEL_SCHEMA_STATES.SCHEMA_ABSENT);
assert.equal(inspectProspectLevelColumnPresence(Object.fromEntries(PROSPECT_LEVEL_SCHEMA_FIELDS.map(field=>[field,true]))).schemaState,PROSPECT_LEVEL_SCHEMA_STATES.PRESENT);
assert.throws(()=>withProspectLevelSchemaState([{...corePlayer(),current_level:null}]),/partially available/);

assert.equal(isMissingProspectLevelColumnError(missingColumn("current_level"),"current_level"),true);
assert.equal(isMissingProspectLevelColumnError(Object.assign(new Error("Could not find the 'level_source' column of 'players' in the schema cache"),{code:"PGRST204"}),"level_source"),true);
assert.equal(isMissingProspectLevelColumnError(new Error("permission denied for column current_level"),"current_level"),false);
assert.equal(isMissingProspectLevelColumnError(Object.assign(new Error("column players.name does not exist"),{code:"42703"})),false);
assert.equal(isMissingProspectLevelColumnError(new Error("network request failed")),false);
assert.equal(isMissingProspectLevelColumnError({unexpected:true}),false);

let absentReads=0,absentProbes=0;
const absentPlayers=[corePlayer(1),corePlayer(2)];
const absent=await enrichPlayersWithProspectLevelEvidence("league",absentPlayers,{readEvidenceBatch:async()=>{absentReads++;throw missingColumn("current_level")},probeColumn:async(_leagueId,field)=>{absentProbes++;assert(PROSPECT_LEVEL_SCHEMA_FIELDS.includes(field));return false}});
assert.equal(absentReads,1);assert.equal(absentProbes,5,"schema absence uses a constant five-column probe, not per-player reads");
assert.equal(absent.length,2);assert.equal(absent[0].prospectLevelSchemaState,"SCHEMA_ABSENT");
assert.equal(absent[0].id,absentPlayers[0].id);assert.equal(absent[0].fantrax_id,"f-1");assert.equal(absent[0].mlbam_id,1001);assert.equal(absent[0].owner_team_id,"team-1");assert.equal(absent[0].roster_status,"MINORS");
for(const field of PROSPECT_LEVEL_SCHEMA_FIELDS)assert.equal(Object.prototype.hasOwnProperty.call(absent[0],field),false,"schema absence does not fabricate null database fields");

for(const presentFields of [PROSPECT_LEVEL_SCHEMA_FIELDS.slice(0,2),PROSPECT_LEVEL_SCHEMA_FIELDS.slice(0,4)]){
  await assert.rejects(enrichPlayersWithProspectLevelEvidence("league",[corePlayer()],{readEvidenceBatch:async()=>{throw missingColumn(PROSPECT_LEVEL_SCHEMA_FIELDS.find(field=>!presentFields.includes(field)))},probeColumn:async(_leagueId,field)=>presentFields.includes(field)}),error=>error.code==="PROSPECT_LEVEL_SCHEMA_PARTIAL");
}
for(const failure of [new Error("permission denied for table players"),new Error("network request failed"),Object.assign(new Error("division by zero"),{code:"22012"}),{unexpected:true}]){
  await assert.rejects(enrichPlayersWithProspectLevelEvidence("league",[corePlayer()],{readEvidenceBatch:async()=>{throw failure},probeColumn:async()=>{throw new Error("probe must not run")}}),error=>error===failure,"non-schema failures remain failures");
}

const pagedPlayers=Array.from({length:PROSPECT_LEVEL_EVIDENCE_BATCH_SIZE*2+5},(_,index)=>corePlayer(index+1));
let presentReads=0,presentProbes=0;
const present=await enrichPlayersWithProspectLevelEvidence("league",pagedPlayers,{readEvidenceBatch:async(_leagueId,ids)=>{presentReads++;return ids.slice().reverse().map(id=>evidence(id,id===uuid(1)?{current_level:"AAA",level_source:"MLB_STATS_API",level_availability:"AVAILABLE",level_observed_at:"2026-08-20T00:00:00Z",level_raw_evidence:{sportId:11}}:{}))},probeColumn:async()=>{presentProbes++;return true}});
assert.equal(presentReads,3,"optional evidence reads are bounded pages");assert.equal(presentProbes,0,"healthy schema requires no probe fan-out");assert.equal(present.length,pagedPlayers.length);
assert.equal(present[0].id,uuid(1));assert.equal(present[0].current_level,"AAA");assert.equal(present[0].prospectLevelSchemaState,"PRESENT");assert.equal(present[1].current_level,null,"factual null remains null");
assert.equal(present[0].owner_team_id,"team-1");assert.equal(present[0].roster_status,"MINORS");
await assert.rejects(enrichPlayersWithProspectLevelEvidence("league",[corePlayer()],{readEvidenceBatch:async()=>[],probeColumn:async()=>true}),/complete optional schema|every requested player UUID/);
await assert.rejects(enrichPlayersWithProspectLevelEvidence("league",[corePlayer()],{readEvidenceBatch:async()=>null,probeColumn:async()=>true}),/malformed response/);

const league={id:"league",settings:{}},absentInput=buildCanonicalPlayerIntelligenceInput({player:absent[0],league,season:2026,metricRows:[],asOfDate:"2026-08-20T01:00:00Z"});
assert.equal(absentInput.ageDevelopment.level,null);assert.equal(absentInput.ageDevelopment.levelSource,null);assert.equal(absentInput.ageDevelopment.levelAvailability,"SCHEMA_ABSENT");assert.equal(absentInput.ageDevelopment.levelFreshness,null);assert.equal(absentInput.ageDevelopment.levelRawEvidence,null);assert.equal(absentInput.prospectContext.levelSchemaState,"SCHEMA_ABSENT");
const presentInput=buildCanonicalPlayerIntelligenceInput({player:present[0],league,season:2026,metricRows:[],asOfDate:"2026-08-20T01:00:00Z"});
assert.equal(presentInput.prospectContext.level,"AAA");assert.equal(presentInput.prospectContext.levelSource,"MLB_STATS_API");assert.equal(presentInput.prospectContext.levelAvailability,"AVAILABLE");assert.equal(presentInput.prospectContext.levelSchemaState,"PRESENT");
const nullInput=buildCanonicalPlayerIntelligenceInput({player:present[1],league,season:2026,metricRows:[],asOfDate:"2026-08-20T01:00:00Z"});assert.equal(nullInput.prospectContext.levelAvailability,"UNKNOWN");assert.equal(nullInput.prospectContext.levelSchemaState,"PRESENT");

const loaded=await loadCanonicalPlayerIntelligenceInput({leagueId:"league",playerId:uuid(1),season:2026,repositories:{players:{allPlayers:async()=>[corePlayer(1)]},metrics:{listMetrics:async()=>[]},leagues:{leagueById:async()=>league}}});
assert.equal(loaded.prospectContext.levelSchemaState,"SCHEMA_ABSENT");assert.equal(loaded.prospectContext.level,null);
await assert.rejects(loadCanonicalPlayerIntelligenceInput({leagueId:"league",playerId:uuid(1),season:2026,repositories:{players:{allPlayers:async()=>[{...corePlayer(1),current_level:null}]},metrics:{listMetrics:async()=>[]},leagues:{leagueById:async()=>league}}}),/partially available/);

for(const field of PROSPECT_LEVEL_SCHEMA_FIELDS)assert.equal(PLAYER_INTELLIGENCE_BASE_PLAYER_COLUMNS.includes(field),false,`${field} is not mandatory in the base projection`);
for(const field of ["id","fantrax_id","mlbam_id","name","age","positions","is_minor_leaguer","owner_team_id","roster_status","teams:owner_team_id"])assert(PLAYER_INTELLIGENCE_BASE_PLAYER_COLUMNS.includes(field),`${field} remains in the base projection`);
const root=new URL("../",import.meta.url),repository=await readFile(new URL("v5/js/repositories/playerIntelligenceRepository.js",root),"utf8"),main=await readFile(new URL("v5/js/main.js",root),"utf8"),playerRepository=await readFile(new URL("v5/js/repositories/playerRepository.js",root),"utf8");
assert.match(repository,/players!inner\(\$\{PLAYER_INTELLIGENCE_BASE_PLAYER_COLUMNS\}\)/);assert.match(repository,/select\(PROSPECT_LEVEL_EVIDENCE_COLUMNS\)/);assert.match(repository,/\.in\("id",playerIds\)/);assert.doesNotMatch(repository,/name[^\n]+prospect.level|prospect.level[^\n]+name/i);
assert.match(main,/refreshLeagueData[\s\S]*playerPage=await loadPlayerPage\(\)/);assert.match(main,/loadPlayerPage[\s\S]*listPlayerIntelligence/);
assert.match(playerRepository,/allPlayers\(leagueId\)\{\s*return selectAllLeagueRows\("players",leagueId,\{order:"name"/);

console.log("v5 prospect level schema bootstrap tests passed");
