import assert from "node:assert/strict";

globalThis.window={
  DynastyMigrationService:{
    normalizeName(value){
      return String(value||"").trim().toLowerCase().replace(/\s+/g," ");
    }
  }
};
globalThis.localStorage={
  getItem(){return "[]"}
};

const { buildFantraxPreviewSummary } = await import(`../js/services/cloudCsvImportService.js?preview-test=${Date.now()}`);

const leagueId="11111111-1111-4111-8111-111111111111";
const head=["ID","Player","Status","Position","Team","Age"];
const file={name:"fantrax.csv"};

function rows(count,{matchingFantraxId=""}={}){
  return Array.from({length:count},(_,index)=>{
    const fantraxId=index===0&&matchingFantraxId?matchingFantraxId:`FT-${index+1}`;
    return [fantraxId,`Imported Player ${index+1}`,"FREE AGENT","SS","ATL","24"];
  });
}

function previewFor(importRows,players){
  return buildFantraxPreviewSummary({
    leagueId,
    file,
    rows:importRows,
    head,
    maps:{players,teams:new Map()}
  });
}

const existingPlayer={
  id:"22222222-2222-4222-8222-222222222222",
  league_id:leagueId,
  fantrax_id:"FT-MATCH",
  mlbam_id:123,
  name:"Existing Player",
  normalized_name:"existing player",
  positions:["SS"],
  mlb_team:"ATL"
};

const oneMatchPreview=previewFor(rows(150,{matchingFantraxId:"FT-MATCH"}),[existingPlayer]);
assert.equal(oneMatchPreview.validRows,150);
assert.equal(oneMatchPreview.existingCloudMatches,1);
assert.equal(oneMatchPreview.newPlayersToInsert,149);
assert.equal(oneMatchPreview.identityConflicts,0);
assert.equal(oneMatchPreview.unmatchedRows,0);
assert.equal(oneMatchPreview.cloudPlayersLoaded,1);
assert.equal(oneMatchPreview.matchedRecords,1);
assert.equal(
  oneMatchPreview.validRowsAfterDeduplication,
  oneMatchPreview.existingCloudMatches+
    oneMatchPreview.newPlayersToInsert+
    oneMatchPreview.identityConflicts+
    oneMatchPreview.unmatchedRows
);

const noMatchPreview=previewFor(rows(150),[existingPlayer]);
assert.equal(noMatchPreview.validRows,150);
assert.equal(noMatchPreview.existingCloudMatches,0);
assert.equal(noMatchPreview.newPlayersToInsert,150);
assert.equal(noMatchPreview.identityConflicts,0);
assert.equal(noMatchPreview.unmatchedRows,0);
assert.equal(noMatchPreview.matchedRecords,0);

const duplicateUuidPreview=previewFor([
  ["FT-MATCH","Existing Player","FREE AGENT","SS","ATL","24"],
  ["FT-MATCH","Existing Player Update","FREE AGENT","SS","ATL","25"]
],[existingPlayer]);
assert.equal(duplicateUuidPreview.existingCloudMatches,1);
assert.equal(duplicateUuidPreview.duplicateFantraxIds,1);
assert.equal(duplicateUuidPreview.updateResolutionDiagnostics.uniqueMatchedPlayerUuids,1);
assert.equal(duplicateUuidPreview.updateResolutionDiagnostics.largestResolvedUuidGroupSize,1);

const splitIdentityPreview=previewFor([
  ["FT-MATCH","Existing Player","FREE AGENT","SS","ATL","24"],
  ["FT-OTHER","Existing Player","FREE AGENT","SS","ATL","24"]
],[existingPlayer]);
assert.equal(splitIdentityPreview.existingCloudMatches,1);
assert.equal(splitIdentityPreview.newPlayersToInsert,1);
assert.equal(splitIdentityPreview.identityConflicts,0);

const fallbackTarget={
  id:"a165a59f-7626-48f3-a925-634ff838e6e3",
  league_id:leagueId,
  name:"Repeated Fallback",
  normalized_name:"repeated fallback",
  positions:["SS"],
  mlb_team:"ATL"
};
const repeatedFallbackPreview=previewFor(
  Array.from({length:12},(_,index)=>[`FT-FALLBACK-${index+1}`,"Repeated Fallback","FREE AGENT","SS","ATL","24"]),
  [fallbackTarget]
);
assert.equal(repeatedFallbackPreview.existingCloudMatches,0);
assert.equal(repeatedFallbackPreview.newPlayersToInsert,12);
assert.equal(repeatedFallbackPreview.updateDecisionDiagnostics.totalUpdateDecisions,0);
assert.equal(repeatedFallbackPreview.updateDecisionDiagnostics.uniqueMatchedPlayerUuids,0);
assert.equal(repeatedFallbackPreview.updateDecisionDiagnostics.largestSourceRowsPerUuid,0);
assert.deepEqual(repeatedFallbackPreview.updateDecisionDiagnostics.groups,[]);
assert.equal(repeatedFallbackPreview.resolverEdgeCaseDiagnostics.fallbackRequiresNameTeamPosition,true);

const blankFantraxPreview=previewFor([
  ["","Blank Fantrax","FREE AGENT","SS","ATL","24"]
],[{...existingPlayer,id:"blank-fantrax-existing",fantrax_id:"",name:"Blank Fantrax",normalized_name:"blank fantrax"}]);
assert.equal(blankFantraxPreview.resolverEdgeCaseDiagnostics.blankFantraxNeverMatchesBlankFantrax,true);
assert.equal(blankFantraxPreview.resolverEdgeCaseDiagnostics.blankFantraxUpdateMatches,0);

const zeroMlbamPreview=buildFantraxPreviewSummary({
  leagueId,
  file,
  rows:[["FT-ZERO","Zero MLBAM","FREE AGENT","SS","ATL","24","0"]],
  head:["ID","Player","Status","Position","Team","Age","MLBAM ID"],
  maps:{players:[{...existingPlayer,id:"zero-mlbam-existing",fantrax_id:"",mlbam_id:0,name:"Zero MLBAM",normalized_name:"zero mlbam"}],teams:new Map()}
});
assert.equal(zeroMlbamPreview.resolverEdgeCaseDiagnostics.zeroLikeMlbamRows,1);
assert.equal(zeroMlbamPreview.resolverEdgeCaseDiagnostics.zeroLikeMlbamIdentityDecisions,0);
assert.equal(zeroMlbamPreview.resolverEdgeCaseDiagnostics.zeroLikeMlbamTreatedAsMissing,true);

assert.ok(!oneMatchPreview.updateResolutionDiagnostics.duplicateResolvedUuidGroups.length);
assert.equal(oneMatchPreview.previewPlayerCollectionSource,"cloud players");
assert.equal(oneMatchPreview.matchingAgainst,"cloud players from Supabase public.players for the selected league");

console.log("fantraxPreviewAccounting tests passed");
