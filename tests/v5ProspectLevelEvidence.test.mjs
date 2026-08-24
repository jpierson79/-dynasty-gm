import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {LEVEL_AVAILABILITY,PROSPECT_LEVELS,mergeProspectLevelEvidence,normalizeProspectLevel} from "../v5/js/services/prospectLevelEvidence.js";
import {fetchMlbIdentityCatalog} from "../v5/js/providers/mlbStatsApiProvider.js";
import {buildCanonicalPlayerIntelligenceInput} from "../v5/js/services/playerIntelligenceInputService.js";

const expected=new Map([[1,"MLB"],[11,"AAA"],[12,"AA"],[13,"A_PLUS"],[14,"A"],[16,"ROOKIE"]]);
for(const [sportId,level] of expected)assert.equal(normalizeProspectLevel({sportId,source:"MLB_STATS_API"}).currentLevel,level);
for(const [raw,level] of [["Triple-A","AAA"],["Double-A","AA"],["High-A","A_PLUS"],["Single-A","A"],["FCL","COMPLEX"],["ACL","COMPLEX"],["DSL","DSL"]])assert.equal(normalizeProspectLevel({level:raw,source:"MLB_STATS_API"}).currentLevel,level);
assert.equal(normalizeProspectLevel({level:"unsupported"}).currentLevel,PROSPECT_LEVELS.UNKNOWN);
assert.equal(normalizeProspectLevel({level:""}).levelAvailability,LEVEL_AVAILABILITY.UNKNOWN);
assert.equal(normalizeProspectLevel({sportId:11,active:false}).currentLevel,PROSPECT_LEVELS.INACTIVE);
const conflict=mergeProspectLevelEvidence([normalizeProspectLevel({sportId:1,source:"MLB_STATS_API"}),normalizeProspectLevel({sportId:11,source:"MLB_STATS_API"})]);
assert.equal(conflict.levelAvailability,LEVEL_AVAILABILITY.CONFLICT);assert.equal(conflict.currentLevel,null);

const response=payload=>({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>payload});
const catalog=await fetchMlbIdentityCatalog({season:2026,sportIds:[11,14],fetchImpl:async url=>url.includes("/teams?")?response({teams:[]}):response({people:[{id:101,fullName:"Fixture",active:true,primaryPosition:{abbreviation:"SS"}}]})});
assert.equal(catalog.people[0].levelEvidence.levelAvailability,LEVEL_AVAILABILITY.CONFLICT,"multiple factual levels fail closed rather than choosing one");
assert.ok(catalog.people[0].levelEvidence.levelObservedAt);

const league={id:"league",settings:{}},base={id:"player",league_id:"league",name:"Fixture",age:20,positions:["SS"],mlb_team:"NYY",is_minor_leaguer:true,current_level:"AAA",level_source:"MLB_STATS_API",level_availability:"AVAILABLE",level_observed_at:"2026-08-15T00:00:00Z",level_raw_evidence:{sportId:11},hkb_value:10};
const build=player=>buildCanonicalPlayerIntelligenceInput({player,league,season:2026,metricRows:[],asOfDate:"2026-08-15T01:00:00Z"});
const input=build(base);assert.equal(input.player.isMinorLeaguer,true);assert.equal(input.ageDevelopment.level,"AAA");assert.equal(input.prospectContext.levelSource,"MLB_STATS_API");assert.equal(input.prospectContext.levelAvailability,"AVAILABLE");assert.equal(input.prospectContext.levelFreshness,"2026-08-15T00:00:00.000Z");
for(const patch of [{age:39},{hkb_value:9999},{name:"Different"}])assert.equal(build({...base,...patch}).prospectContext.level,"AAA");
const evidenceRows=[{id:"production",player_id:"player",source:"Fantrax",season:2026,metric_type:"fantrax_league_production",imported_at:"2026-08-15T00:00:00Z",metrics:{fantasyPoints:999}},{id:"statcast",player_id:"player",source:"Statcast",season:2026,metric_type:"statcast_hitting",imported_at:"2026-08-15T00:00:00Z",metrics:{xwoba:.4,_statcast:{fetchedAt:"2026-08-15T00:00:00Z"}}}];
assert.equal(buildCanonicalPlayerIntelligenceInput({player:base,league,season:2026,metricRows:evidenceRows,asOfDate:"2026-08-15T01:00:00Z"}).prospectContext.level,"AAA","production and Statcast evidence cannot determine level");
const unknown=build({...base,is_minor_leaguer:true,current_level:null,level_source:null,level_availability:null,level_observed_at:null,level_raw_evidence:null});assert.equal(unknown.prospectContext.level,null);assert.equal(unknown.prospectContext.levelAvailability,"UNKNOWN");
const absent=build(Object.fromEntries(Object.entries(base).filter(([key])=>!key.startsWith("is_minor"))));assert.equal(absent.player.isMinorLeaguer,null,"unloaded minor status remains unknown, not false");
const mlb=build({...base,is_minor_leaguer:false,current_level:"MLB"});assert.equal(mlb.player.isMinorLeaguer,false);assert.equal(mlb.role.mlbStatus,"MLB");

const root=new URL("../",import.meta.url),repository=await readFile(new URL("v5/js/repositories/playerIntelligenceRepository.js",root),"utf8"),evidenceService=await readFile(new URL("v5/js/services/prospectLevelEvidence.js",root),"utf8"),migration=await readFile(new URL("supabase/migrations/014_prospect_level_evidence.sql",root),"utf8"),composite=await readFile(new URL("v5/js/engine/playerIntelligenceComposite.js",root),"utf8");
assert.match(repository,/is_minor_leaguer/);assert.match(repository,/PROSPECT_LEVEL_SCHEMA_FIELDS/);
for(const column of ["current_level","level_source","level_availability","level_observed_at","level_raw_evidence"])assert.match(evidenceService,new RegExp(column));
assert.match(migration,/add column if not exists current_level text/);assert.match(migration,/level_raw_evidence jsonb/);assert.match(migration,/level_availability in \('AVAILABLE','UNKNOWN','STALE','CONFLICT'\)/);assert.match(migration,/current_level is null and level_source is null/);assert.doesNotMatch(migration,/update public\.players|insert into|delete from/);
assert.doesNotMatch(composite,/current_level|level_source|level_observed_at/,"G0 does not resume archetype classification");
console.log("v5ProspectLevelEvidence tests passed");
