import assert from "node:assert/strict";
import fs from "node:fs";
import {
  setPendingTeamMapping,
  teamIdentitySuggestion,
  teamMappingSaveRows,
  validatePendingTeamMappings,
  validFantraxTeamId
} from "../v5/js/services/fantraxTeamIdentityService.js";

const leagueId="league-1";
const fantraxTeams=[
  {fantraxTeamId:"AAAAAAAAAAAAAAAA",teamName:"Alpha Club"},
  {fantraxTeamId:"BBBBBBBBBBBBBBBB",teamName:"Beta Club"}
];
const cloudTeams=[
  {id:"cloud-a",league_id:leagueId,name:"Alpha Club",manager_id:"manager-a",fantrax_team_id:null},
  {id:"cloud-b",league_id:leagueId,name:"Beta Club",manager_id:"manager-b",fantrax_team_id:null}
];

assert.equal(validFantraxTeamId("AAAAAAAAAAAAAAAA"),true);
assert.equal(validFantraxTeamId(""),false);
assert.equal(teamIdentitySuggestion(fantraxTeams[0],cloudTeams),"cloud-a","team-name equality is a suggestion only");
let pending=setPendingTeamMapping({},fantraxTeams[0].fantraxTeamId,"cloud-a");
pending=setPendingTeamMapping(pending,fantraxTeams[1].fantraxTeamId,"cloud-b");
assert.equal(validatePendingTeamMappings({leagueId,fantraxTeams,cloudTeams,pendingMappings:pending}).valid,true);
const duplicateCloud={...pending,[fantraxTeams[1].fantraxTeamId]:"cloud-a"};
assert.equal(validatePendingTeamMappings({leagueId,fantraxTeams,cloudTeams,pendingMappings:duplicateCloud}).valid,false,"one cloud team cannot map twice");
assert.equal(validatePendingTeamMappings({leagueId,fantraxTeams,cloudTeams:[...cloudTeams,{id:"other",league_id:"other-league",name:"Other"}],pendingMappings:{AAAAAAAAAAAAAAAA:"other"}}).valid,false,"cross-league mapping blocked");
const existing=[{...cloudTeams[0],fantrax_team_id:"CCCCCCCCCCCCCCCC"},cloudTeams[1]];
assert.equal(validatePendingTeamMappings({leagueId,fantraxTeams,cloudTeams:existing,pendingMappings:{AAAAAAAAAAAAAAAA:"cloud-a"}}).valid,false,"replacement requires confirmation");
assert.equal(validatePendingTeamMappings({leagueId,fantraxTeams,cloudTeams:existing,pendingMappings:{AAAAAAAAAAAAAAAA:"cloud-a"},allowReplacement:true}).valid,true);
assert.deepEqual(teamMappingSaveRows({leagueId,cloudTeams,pendingMappings:pending}),[
  {id:"cloud-a",league_id:leagueId,fantrax_team_id:"AAAAAAAAAAAAAAAA",current_fantrax_team_id:""},
  {id:"cloud-b",league_id:leagueId,fantrax_team_id:"BBBBBBBBBBBBBBBB",current_fantrax_team_id:""}
]);

const migration=fs.readFileSync(new URL("../supabase/migrations/007_fantrax_team_identity.sql",import.meta.url),"utf8");
assert.match(migration,/add column if not exists fantrax_team_id text/i);
assert.match(migration,/where fantrax_team_id is not null/i,"nullable identity uses partial uniqueness");
assert.match(migration,/unique index[\s\S]*league_id, fantrax_team_id/i,"identity is unique within league");
assert.doesNotMatch(migration,/update public\.teams|insert into public\.teams|delete from public\.teams/i,"migration has no destructive backfill");

const repository=fs.readFileSync(new URL("../v5/js/repositories/teamRepository.js",import.meta.url),"utf8");
assert.match(repository,/update\(\{fantrax_team_id:fantraxTeamId\}\)/,"repository saves the exact identity field");
assert.match(repository,/eq\("league_id",leagueId\)\.eq\("id",row\.id\)/,"save is constrained to active league and team UUID");
assert.doesNotMatch(repository,/owner_team_id\s*:|roster_status\s*:|manager_id\s*:/,"save cannot change protected player or manager fields");

const main=fs.readFileSync(new URL("../v5/js/main.js",import.meta.url),"utf8");
const view=fs.readFileSync(new URL("../v5/js/views/fantraxPreviewView.js",import.meta.url),"utf8");
for(const text of ["Review Mappings","Save Team Mappings","Cancel Pending Mappings","Confirm Save","It will not change player ownership, roster status, scores, managers, or player identity."])assert.match(view,new RegExp(text));
assert.match(main,/persistFantraxTeamMappings/);
assert.doesNotMatch(view,/Apply Sync/);
assert.doesNotMatch(main,/owner_team_id\s*:|roster_status\s*:/,"team mapping handler contains no player writes");

const health=fs.readFileSync(new URL("../v5/js/services/dataHealthService.js",import.meta.url),"utf8");
for(const name of ["Fantrax Teams Found","Fantrax Team IDs Persisted","Fantrax Team Identity Match Rate","Duplicate Fantrax Team IDs","Unmapped Fantrax Teams","Cloud Teams Without Fantrax IDs","Roster Entries With Valid Team Identity","Ownership Differences Detected","Status Differences Detected","Manual Override Protection Available"])assert.match(health,new RegExp(name));
assert.match(health,/Manual Override Protection Available","WARNING"/);

console.log("V5 Fantrax team identity tests passed.");
