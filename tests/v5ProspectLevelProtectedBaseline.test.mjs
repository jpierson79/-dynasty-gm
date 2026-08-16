import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PROTECTED_BASELINE_PROFILES, PROSPECT_LEVEL_MUTABLE_FIELDS, PROSPECT_LEVEL_UPDATED_AT_DECISION, captureProtectedBaseline, compareProtectedBaselines } from "../v5/js/services/protectedBaselineService.js";
import { renderImports } from "../v5/js/views/importsView.js";

const migration=await readFile(new URL("../supabase/migrations/014_prospect_level_evidence.sql",import.meta.url),"utf8");
const migrationFields=[...migration.matchAll(/add column if not exists\s+(\w+)\s+(?:text|timestamptz|jsonb)/gi)].map(match=>match[1]);
assert.deepEqual(PROSPECT_LEVEL_MUTABLE_FIELDS,migrationFields,"profile fields must be derived from Migration 014");
assert.equal(PROSPECT_LEVEL_UPDATED_AT_DECISION,"UPDATED_AT_EXPECTED_MUTABLE");
assert.match(await readFile(new URL("../supabase/migrations/001_initial_schema.sql",import.meta.url),"utf8"),/players_set_updated_at[\s\S]*before update on public\.players/);
const profile=PROTECTED_BASELINE_PROFILES.PROSPECT_LEVEL_POPULATION;
assert(profile);assert.deepEqual(profile.allowedChanges.players,[...migrationFields,"updated_at"]);assert.deepEqual(profile.allowedChanges.metrics,[]);

const protectedPlayer={id:"p1",league_id:"l1",fantrax_id:"*f1*",fantrax_api_player_id:"f1",mlbam_id:1,name:"Player",age:22,positions:["SS"],is_minor_leaguer:true,mlb_team:"SEA",owner_team_id:"t1",roster_status:"MINORS",is_free_agent:false,hkb_value:10,created_at:"created",updated_at:"before"};
const domains={players:[protectedPlayer],scores:[{id:"s1",score:10}],metrics:[{id:"m1",source:"Statcast",value:1},{id:"m2",source:"Fantrax",metric_type:"fantrax_league_production",value:2},{id:"m3",source:"HKB",value:3}],teams:[{id:"t1",name:"Team"}],managers:[{id:"u1",name:"Manager"}],leagues:[{id:"l1",settings:{season:2026}}]};
const capture=rows=>captureProtectedBaseline({leagueId:"l1",profile:"PROSPECT_LEVEL_POPULATION",dependencies:{readProtectedBaselineDomains:async(_id,options)=>{assert.equal(options.includeLeague,true);return structuredClone(rows)}}});
const before=await capture(domains);
assert.equal(before.status,"AVAILABLE");assert.equal(before.domains.prospectLevelEvidence.schemaState,"SCHEMA_ABSENT");assert.equal(before.domains.players.expectedMutable,false);assert.equal(before.domains.leagues.expectedMutable,false);
const repeat=await capture({...structuredClone(domains),players:[Object.fromEntries(Object.entries(protectedPlayer).reverse())]});
assert.equal(before.domains.players.hash,repeat.domains.players.hash);assert.equal(before.domains.prospectLevelEvidence.hash,repeat.domains.prospectLevelEvidence.hash);

const nullRow={...protectedPlayer,...Object.fromEntries(migrationFields.map(field=>[field,null]))};
const afterMigration=await capture({...structuredClone(domains),players:[nullRow]});
assert.equal(afterMigration.domains.prospectLevelEvidence.schemaState,"PRESENT");assert.equal(before.domains.players.hash,afterMigration.domains.players.hash,"schema transition cannot alter protected player hash");assert.equal(compareProtectedBaselines(before,afterMigration).status,"EXPECTED_MUTATION");

const populated={...nullRow,current_level:"AAA",level_source:"MLB_STATS_API",level_availability:"AVAILABLE",level_observed_at:"2026-08-15T00:00:00Z",level_raw_evidence:{sportId:11},updated_at:"after"};
const populatedCapture=await capture({...structuredClone(domains),players:[populated]});
assert.equal(afterMigration.domains.players.hash,populatedCapture.domains.players.hash);assert.equal(compareProtectedBaselines(afterMigration,populatedCapture).status,"EXPECTED_MUTATION");
for(const field of migrationFields){const changed=structuredClone({...domains,players:[nullRow]});changed.players[0][field]=field==="level_raw_evidence"?{x:1}:field;assert.equal(compareProtectedBaselines(afterMigration,await capture(changed)).status,"EXPECTED_MUTATION",`${field} is expected mutable`)}
const updatedOnly=structuredClone({...domains,players:[nullRow]});updatedOnly.players[0].updated_at="after";assert.equal(compareProtectedBaselines(afterMigration,await capture(updatedOnly)).status,"EXPECTED_MUTATION","database-triggered updated_at is expected mutable");

for(const [field,value] of [["id","p2"],["fantrax_id","*other*"],["mlbam_id",2],["name","Changed"],["age",23],["positions",["OF"]],["is_minor_leaguer",false],["mlb_team","BOS"],["owner_team_id","t2"],["roster_status","ACTIVE"],["is_free_agent",true],["created_at","other"]]){const changed=structuredClone({...domains,players:[nullRow]});changed.players[0][field]=value;assert.equal(compareProtectedBaselines(afterMigration,await capture(changed)).status,"CHANGED",`${field} remains protected`)}
for(const [domain,field] of [["scores","score"],["metrics","value"],["teams","name"],["managers","name"],["leagues","settings"]]){const changed=structuredClone({...domains,players:[nullRow]});changed[domain][0][field]=domain==="leagues"?{season:2027}:"changed";assert.equal(compareProtectedBaselines(afterMigration,await capture(changed)).status,"CHANGED",`${domain} remains protected`)}
const mixed=structuredClone({...domains,players:[nullRow]});mixed.players[0].current_level="AA";mixed.players[0].name="Forbidden";assert.equal(compareProtectedBaselines(afterMigration,await capture(mixed)).status,"CHANGED");
const metricMixed=structuredClone({...domains,players:[nullRow]});metricMixed.players[0].current_level="AA";metricMixed.metrics[0].value=99;assert.equal(compareProtectedBaselines(afterMigration,await capture(metricMixed)).status,"CHANGED");
const partial=structuredClone(domains);partial.players[0].current_level=null;assert.equal((await capture(partial)).status,"QUERY_FAILED","partial schema fails closed");
const failed=await captureProtectedBaseline({leagueId:"l1",profile:"PROSPECT_LEVEL_POPULATION",dependencies:{readProtectedBaselineDomains:async()=>{throw new Error("permission denied")}}});assert.equal(failed.status,"PERMISSION_BLOCKED");

const ui=renderImports({}, {prospectLevelBaseline:{evidence:before},mlbamBackfill:{},statcast:{}});
assert.match(ui,/PROSPECT_LEVEL_POPULATION/);assert.match(ui,/SCHEMA_ABSENT/);assert.match(ui,/updated_at<\/b> is database-triggered/);assert.match(ui,/captureProspectLevelProtectedBaseline/);assert.doesNotMatch(ui,/profile selector/i);
const main=await readFile(new URL("../v5/js/main.js",import.meta.url),"utf8");assert.match(main,/captureProspectLevelProtectedBaseline[\s\S]{0,500}profile:"PROSPECT_LEVEL_POPULATION"/);assert.doesNotMatch(main,/captureProspectLevelProtectedBaseline[\s\S]{0,500}profile:"(?:STRICT|MLBAM_BACKFILL|STATCAST_REFRESH|FANTRAX_PRODUCTION_IMPORT)"/);
const repository=await readFile(new URL("../v5/js/repositories/protectedBaselineRepository.js",import.meta.url),"utf8");assert.doesNotMatch(repository,/insert\(|update\(|upsert\(|delete\(/);assert.match(repository,/includeLeague\?d\.leagueById/);
console.log("v5 prospect level protected baseline tests passed");
