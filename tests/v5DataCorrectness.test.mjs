import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { table } from "../v5/js/components/table.js";
import { invalidFantasyTeamReason, isValidFantasyTeam, validFantasyTeamsForPlayers } from "../v5/js/domain/teamRules.js";
import { normalizeRosterStatus } from "../v5/js/domain/rosterStatus.js";

const root=new URL("../",import.meta.url);
const v5Css=await readFile(new URL("v5/css/styles.css",root),"utf8");
const importsView=await readFile(new URL("v5/js/views/importsView.js",root),"utf8");
const teamsView=await readFile(new URL("v5/js/views/teamsManagersView.js",root),"utf8");
const teamRepo=await readFile(new URL("v5/js/repositories/teamRepository.js",root),"utf8");
const managerRepo=await readFile(new URL("v5/js/repositories/managerRepository.js",root),"utf8");
const playerRepo=await readFile(new URL("v5/js/repositories/playerRepository.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");
const cloudCsvImport=await readFile(new URL("js/services/cloudCsvImportService.js",root),"utf8");

const validTeams=[
  {id:"t1",name:"Aces",abbreviation:"ACE"},
  {id:"t2",name:"Bombers",abbreviation:"BOM"},
  {id:"t3",name:"Caps",abbreviation:"CAP"},
  {id:"t4",name:"Dragons",abbreviation:"DRA"},
  {id:"t5",name:"Express",abbreviation:"EXP"},
  {id:"t6",name:"Fury",abbreviation:"FUR"},
  {id:"t7",name:"Giants",abbreviation:"GIA"},
  {id:"t8",name:"Hammers",abbreviation:"HAM"},
  {id:"t9",name:"Icons",abbreviation:"ICO"},
  {id:"t10",name:"Jets",abbreviation:"JET"}
];
const invalidTeams=[
  {id:"bad1",name:"FREE AGENT",abbreviation:"FA"},
  {id:"bad2",name:"Waivers <small>Jul 18</small>",abbreviation:"W"},
  {id:"bad3",name:"ROSTERED",abbreviation:"ROS"},
  {id:"bad4",name:"Unknown",abbreviation:"UNK"}
];

assert.equal(validTeams.filter(isValidFantasyTeam).length,10);
assert.equal([...validTeams,...invalidTeams].filter(isValidFantasyTeam).length,10);
assert.deepEqual(validFantasyTeamsForPlayers([...validTeams,{id:"stale",name:"Stott's Tots",abbreviation:"ST"}],validTeams.map(team=>({owner_team_id:team.id}))).map(team=>team.id),validTeams.map(team=>team.id));
assert.equal(invalidFantasyTeamReason({id:"stale",name:"Grand Theft Votto",abbreviation:"GTV"},{playerCount:0}),"no owned players in active league");
invalidTeams.forEach(team=>assert.ok(invalidFantasyTeamReason(team),`${team.name} should have an exclusion reason`));
assert.match(teamRepo,/playerCountByTeam/);
assert.match(dataHealth,/validFantasyTeamsForPlayers\(rawTeamRows,playerRows\)/);
assert.match(dataHealth,/Expected valid team count = 10/);
assert.match(dataHealth,/Excluded invalid team rows/);
assert.doesNotMatch(playerRepo,/columns:"[^"]*availability_status/);

assert.equal(normalizeRosterStatus("Active",{ownerTeamId:"t1"}),"ACTIVE");
assert.equal(normalizeRosterStatus("Starter",{ownerTeamId:"t1"}),"ACTIVE");
assert.equal(normalizeRosterStatus("Bench",{ownerTeamId:"t1"}),"RESERVE");
assert.equal(normalizeRosterStatus("IR",{ownerTeamId:"t1"}),"IL");
assert.equal(normalizeRosterStatus("IL60",{ownerTeamId:"t1"}),"IL");
assert.equal(normalizeRosterStatus("MiLB",{ownerTeamId:"t1"}),"MINORS");
assert.equal(normalizeRosterStatus("Farm",{ownerTeamId:"t1"}),"MINORS");
assert.equal(normalizeRosterStatus("ROSTERED",{ownerTeamId:"t1"}),"UNCLASSIFIED");
assert.equal(normalizeRosterStatus("",{ownerTeamId:"t1"}),"UNCLASSIFIED");
assert.equal(normalizeRosterStatus("FA",{ownerTeamId:"t1"}),"UNCLASSIFIED");
assert.equal(normalizeRosterStatus("Waivers",{ownerTeamId:null,isFreeAgent:true}),"FREE_AGENT");

assert.doesNotMatch(teamsView,/managers\.find\(item=>item\.team_name===team\.name\)/);
assert.match(teamsView,/Unassigned\./);
assert.match(managerRepo,/selectLeagueRows\("managers"/);
assert.doesNotMatch(managerRepo,/listTeams|STATUS_TEAM_TOKENS/);

const renderedTable=table([{label:"Name",value:"name"}],[{name:"Ada"}]);
assert.match(renderedTable,/<table><thead><tr><th>Name<\/th><\/tr><\/thead><tbody><tr><td>Ada<\/td><\/tr><\/tbody><\/table>/);
assert.doesNotMatch(renderedTable,/<tbody>[\s\S]*<th>/);
assert.match(v5Css,/th\{[^}]*position:sticky;top:0;z-index:2/);

assert.match(importsView,/class="import-grid"/);
assert.match(importsView,/class="import-card"/);
assert.match(v5Css,/grid-template-columns:repeat\(auto-fit,minmax\(260px,1fr\)\)/);
assert.doesNotMatch(importsView,/class="grid">\$\{importTypes/);

assert.match(cloudCsvImport,/exactHeaderIndex\(head,\["MLBAM ID","MLB ID","MLB Player ID"\]\)/);
assert.match(cloudCsvImport,/const playerIx=map\.find\(\["player_id","mlbam","mlbam id"\]\)/);
assert.match(cloudCsvImport,/mlbam_id:playerId/);
assert.match(cloudCsvImport,/resolveStatcastPlayer\(maps,\{league_id:leagueId,fantrax_id:fantraxId,mlbam_id:playerId/);
assert.match(cloudCsvImport,/mlbamBackfilled/);
assert.match(cloudCsvImport,/mlbamConflicts/);
assert.doesNotMatch(cloudCsvImport,/mlbam_id\s*:\s*norm\(name\)|Math\.random\(|crypto\.randomUUID\(\).*mlbam|hash/i);

console.log("v5DataCorrectness tests passed");
