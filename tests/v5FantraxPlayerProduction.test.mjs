import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FANTRAX_PLAYERS_HEADER, classifyFantraxProductionStatus, fantraxProductionMetricRow, normalizeFantraxPlayersRawRow, previewFantraxPlayerProduction } from "../v5/js/services/fantraxPlayerProductionService.js";
import { buildCanonicalPlayerIntelligenceInput } from "../v5/js/services/playerIntelligenceInputService.js";
import { ENGINE_VERSION } from "../v5/js/engine/dynastyEngine.js";

const leagueId="11111111-1111-4111-8111-111111111111",playerId="22222222-2222-4222-8222-222222222222",importedAt="2026-08-13T12:00:00.000Z";
const league={id:leagueId,name:"Reddit Phanatics",settings:{fantraxSeasonContext:{externalLeagueId:"1234567890abcdef",seasonYear:2026,leagueHistoryId:"history-1"}}};
const player={id:playerId,league_id:leagueId,name:"Matt Olson",fantrax_id:"*02mwm*",fantrax_api_player_id:"02mwm",positions:["1B"],owner_team_id:"team-1",roster_status:"ACTIVE"};
const olson=["*02mwm*","Matt Olson","ATL","1B","1","Rhys","32","","662.5","5.48","100","32.9","100%","0%","91%","-8%","100%","99%"];

const raw=normalizeFantraxPlayersRawRow(olson);
assert.equal(raw.valid,true);assert.equal(raw.rawValues.length,18);assert.equal(raw.raw.rawRosDelta,"0%");assert.equal(raw.raw.rawActDelta,"-8%");assert.equal(raw.raw.rawUnlabeled16,"100%");assert.equal(raw.raw.rawUnlabeled17,"99%");assert.equal(raw.raw.fantasyPoints,"662.5");assert.equal(raw.raw.fantasyPointsPerGame,"5.48");
assert.equal(normalizeFantraxPlayersRawRow(olson.slice(0,17)).valid,false,"unexpected arity fails closed");

const preview=previewFantraxPlayerProduction({league,header:FANTRAX_PLAYERS_HEADER,rows:[olson],players:[player],sourceFilename:"Fantrax-Players-Reddit Phanatics (17).csv",importedAt});
assert.equal(preview.writePerformed,false);assert.equal(preview.schemaEvidence.headerCount,16);assert.equal(preview.schemaEvidence.rowCountExpected,18);assert.equal(preview.schemaEvidence.headerRowArityMismatch,"REVIEWED_ACCEPTABLE");assert.equal(preview.records[0].fantasyPoints,662.5);assert.equal(preview.records[0].fantasyPointsPerGame,5.48);assert.deepEqual(preview.records[0].positionEligibility,["1B"]);assert.equal(preview.records[0].playerId,playerId);assert.equal(preview.records[0].fantraxId,"02mwm");assert.equal(preview.records[0].season,2026);assert.equal(preview.records[0].statusEvidence.classification,"ROSTERED_TEAM_TOKEN");assert.equal(preview.records[0].statusEvidence.ownerTeamId,null);

const row=(overrides={})=>{const value=[...olson];for(const [index,entry] of Object.entries(overrides))value[Number(index)]=entry;return value};
const numbers=previewFantraxPlayerProduction({league,header:FANTRAX_PLAYERS_HEADER,rows:[row({0:"*zero*",1:"Zero",8:"0",9:"0"}),row({0:"*blank*",1:"Blank",8:"",9:""}),row({0:"*whole*",1:"Whole",8:"647",9:"5.39"})],players:[{id:"zero-id",fantrax_api_player_id:"zero"},{id:"blank-id",fantrax_api_player_id:"blank"},{id:"whole-id",fantrax_api_player_id:"whole"}],importedAt});
assert.equal(numbers.records[0].fantasyPoints,0);assert.equal(numbers.records[0].fantasyPointsPerGame,0);assert.equal(numbers.records[0].status,"AVAILABLE");assert.equal(numbers.records[1].fantasyPoints,null);assert.equal(numbers.records[1].fantasyPointsPerGame,null);assert.equal(numbers.records[1].status,"MISSING");assert.equal(numbers.records[2].fantasyPoints,647);

const positions=previewFantraxPlayerProduction({league,header:FANTRAX_PLAYERS_HEADER,rows:[row({0:"*multi1*",3:"2B,SS"}),row({0:"*multi2*",3:"SP,RP"})],players:[{id:"multi-1",fantrax_api_player_id:"multi1"},{id:"multi-2",fantrax_api_player_id:"multi2"}],importedAt});
assert.deepEqual(positions.records[0].positionEligibility,["2B","SS"]);assert.deepEqual(positions.records[1].positionEligibility,["SP","RP"]);
assert.equal(classifyFantraxProductionStatus("FA").classification,"FA");assert.equal(classifyFantraxProductionStatus("KMG").classification,"ROSTERED_TEAM_TOKEN");assert.equal(classifyFantraxProductionStatus("W <small>(Thu)</small>").classification,"WAIVER_STATE");assert.equal(classifyFantraxProductionStatus("W <small>(Thu)</small>").ownerTeamId,null);
assert.throws(()=>previewFantraxPlayerProduction({league,header:[...FANTRAX_PLAYERS_HEADER,"extra"],rows:[olson],players:[player]}),/reviewed 16-column/);
const nameOnly=previewFantraxPlayerProduction({league,header:FANTRAX_PLAYERS_HEADER,rows:[row({0:"",1:"Matt Olson"})],players:[player],importedAt});assert.equal(nameOnly.records[0].playerId,null);assert.equal(nameOnly.records[0].status,"UNAVAILABLE");
const noSeason=previewFantraxPlayerProduction({league:{...league,settings:{}},header:FANTRAX_PLAYERS_HEADER,rows:[olson],players:[player],importedAt});assert.equal(noSeason.records[0].season,null);assert.equal(noSeason.records[0].status,"UNAVAILABLE");assert.ok(noSeason.records[0].warnings.includes("SEASON_CONTEXT_UNAVAILABLE"));
const duplicated=previewFantraxPlayerProduction({league,header:FANTRAX_PLAYERS_HEADER,rows:[olson,olson],players:[player],importedAt});assert.equal(duplicated.duplicateSourceIds.length,1);assert.ok(duplicated.records.every(record=>record.status==="UNAVAILABLE"));

const metric=fantraxProductionMetricRow(preview.records[0]);assert.equal(metric.source,"Fantrax");assert.equal(metric.metric_type,"fantrax_league_production");assert.equal(metric.metrics.fantasyPoints,662.5);assert.equal(metric.metrics.positionEligibility[0],"1B");assert.equal(metric.metrics._fantraxProduction.sourceFilename,"Fantrax-Players-Reddit Phanatics (17).csv");
const input=buildCanonicalPlayerIntelligenceInput({player,league,metricRows:[{id:"production-1",...metric}],season:2026,asOfDate:"2026-08-13T13:00:00.000Z"});assert.equal(input.production.fantasyPoints,662.5);assert.equal(input.production.fantasyPointsPerGame,5.48);assert.equal(input.production.source,"Fantrax");assert.equal(input.production.season,2026);assert.equal(input.production.status,"AVAILABLE");assert.equal(input.dataFreshness.fantrax.source,"Fantrax");
const wrongType=buildCanonicalPlayerIntelligenceInput({player,league,metricRows:[{...metric,metric_type:"team_matchup_score"}],season:2026});assert.equal(wrongType.production.fantasyPoints,null,"team totals cannot become player production");
assert.equal(ENGINE_VERSION,"5.1.1");
const source=await readFile(new URL("../v5/js/services/fantraxPlayerProductionService.js",import.meta.url),"utf8");assert.doesNotMatch(source,/upsert|insert\(|update\(|delete\(|\.from\(/,"preview and mapping are write-free");
console.log("v5FantraxPlayerProduction tests passed");
