import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifyHkbRows } from "../js/services/cloudCsvImportService.js";

const head=["Rank","Name","Value","Age","Positions","Team","Level"];
const players=[
  {id:"player-1",name:"Julio Rodríguez",normalized_name:"julio rodriguez",fantrax_id:"*abc*",mlbam_id:677594,mlb_team:"SEA",positions:["OF"],owner_team_id:"team-1",roster_status:"ACTIVE",is_free_agent:false},
  {id:"player-2",name:"Max Muncy",mlb_team:"ATH",positions:["2B","3B"]},
  {id:"player-3",name:"Max Muncy",mlb_team:"LAD",positions:["3B"]}
];
const report=classifyHkbRows({rows:[["1","Julio Rodriguez","5000","25","OF","SEA","MLB"],["2","Max Muncy","400","24","2B, 3B","ATH","MLB"],["3","Max Muncy","350","35","3B","","MLB"],["4","2027 Early 1st","1400","","","",""]],head,players,leagueId:"league-1"});
assert.equal(report.summary.totalSourceRows,4);
assert.equal(report.summary.nonPlayerAssets,1);
assert.equal(report.summary.normalizationMismatches,1);
assert.equal(report.summary.contextualMatches,1);
assert.equal(report.summary.ambiguousRows,1,"Duplicate name without sufficient team context remains skipped");
assert.equal(report.classifications[0].matchedPlayerId,"player-1");
assert.equal(report.classifications[0].player.fantrax_id,"*abc*","Classification must not overwrite identity fields");
assert.equal(report.classifications[0].player.owner_team_id,"team-1");
assert.equal(report.classifications[0].player.roster_status,"ACTIVE");
assert.equal(report.classifications[0].player.is_free_agent,false);

const source=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");
const hkbImport=source.slice(source.indexOf("async function importHkb"),source.indexOf("const hitterMetrics"));
assert.match(source,/reviewedPreview\?\.previewSchema!=="hkb-matching-v1"/);
assert.match(source,/reviewedPreview\.hkbDecisions/);
assert.match(source,/hkbDiagnostics:diagnosticRows\.map\(hkbExceptionDetail\)/);
assert.match(source,/legacyMatchSummary:\{matched:legacyMatched,unmatched:rows\.length-legacyMatched\}/);
assert.match(source,/syncResolvedPlayers\(\{updates:uniqueUpdates,inserts:\[\]\}/,"HKB must batch updates and never insert players");
assert.doesNotMatch(hkbImport,/cloudStore\.updateRow\("players"/,"HKB must not write players one row at a time");
assert.match(source,/hkb_value:decision\.sourceValue,overall_rank:decision\.sourceOverallRank,position_rank:decision\.sourcePositionRank/);

console.log("hkbImportSafety tests passed");
