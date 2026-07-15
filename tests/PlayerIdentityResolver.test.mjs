import assert from "node:assert/strict";
import { PlayerIdentityResolution, PlayerIdentityResolver } from "../js/services/PlayerIdentityResolver.js";
import { InMemoryPlayerIdentityRepository } from "../js/services/identity/InMemoryPlayerIdentityRepository.js";

function player(patch){
  return {
    id:patch.id,
    name:patch.name||"Player",
    normalized_name:patch.normalized_name||patch.name?.toLowerCase()||"player",
    fantrax_id:patch.fantrax_id,
    mlbam_id:patch.mlbam_id,
    mlb_team:patch.mlb_team||"NYY",
    positions:patch.positions||["OF"]
  };
}

function resolve(existingPlayers,importedPlayer){
  return new PlayerIdentityResolver({existingPlayers}).resolve({
    name:"Incoming Player",
    normalized_name:"incoming player",
    mlb_team:"NYY",
    positions:["OF"],
    ...importedPlayer
  });
}

function assertMetadata(result){
  assert.equal(result.resolverVersion,"2.0");
  assert.equal(typeof result.resolvedAt,"string");
  assert.equal(Number.isNaN(Date.parse(result.resolvedAt)),false);
  assert.equal(typeof result.resolutionKey,"string");
  assert.ok(result.resolutionKey.length>0);
  assert.equal(typeof result.confidenceScore,"number");
  assert.equal(Array.isArray(result.trace),true);
  assert.ok(result.trace.length>0);
  result.trace.forEach(item=>assert.equal(typeof item,"string"));
}

function assertCandidateShape(candidate){
  assert.equal(typeof candidate.id,"string");
  assertIncomingShape(candidate);
}

function assertIncomingShape(candidate){
  assert.equal(typeof candidate.name,"string");
  assert.equal(typeof candidate.normalizedName,"string");
  assert.equal(typeof candidate.fantraxId,"string");
  assert.equal(typeof candidate.mlbamId,"string");
  assert.equal(typeof candidate.team,"string");
  assert.equal(Array.isArray(candidate.positions),true);
}

{
  const existing=player({id:"p-fantrax",name:"Stable Player",fantrax_id:"FTX-1"});
  const result=resolve([existing],{fantrax_id:"FTX-1",name:"Stable Player",normalized_name:"stable player"});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-fantrax");
  assert.equal(result.confidence,"high");
  assert.equal(result.matchSource,"fantrax_id");
  assert.equal(result.reason,"fantrax_id_match");
  assert.equal(result.diagnostics.candidateCounts.fantrax,1);
  assert.equal(Object.isFrozen(result),true);
  assertMetadata(result);
  assert.equal(result.confidenceScore,1.00);
}

{
  const existing=player({id:"p-trimmed",fantrax_id:"FTX-TRIM"});
  const result=resolve([existing],{fantrax_id:"  FTX-TRIM  "});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-trimmed");
  assert.equal(result.matchSource,"fantrax_id");
}

{
  const existing=player({id:"p-mlbam",name:"Mlbam Player",mlbam_id:12345});
  const result=resolve([existing],{mlbam_id:12345,name:"Mlbam Player",normalized_name:"mlbam player"});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-mlbam");
  assert.equal(result.confidence,"high");
  assert.equal(result.matchSource,"mlbam_id");
  assert.equal(result.confidenceScore,0.98);
}

{
  const existing=player({id:"p-both",fantrax_id:"FTX-BOTH",mlbam_id:777});
  const result=resolve([existing],{fantrax_id:"FTX-BOTH",mlbam_id:777});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-both");
  assert.equal(result.matchSource,"fantrax_id");
}

{
  const existing=player({id:"p-mlbam-backstop",mlbam_id:222});
  const result=resolve([existing],{fantrax_id:"FTX-NEW",mlbam_id:222});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-mlbam-backstop");
  assert.equal(result.matchSource,"mlbam_id");
}

{
  const existing=player({id:"p-fallback",name:"Fallback Player",normalized_name:"fallback player",mlb_team:"SEA",positions:["SS"]});
  const result=resolve([existing],{name:"Fallback Player",normalized_name:"fallback player",mlb_team:"SEA",positions:["SS"]});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-fallback");
  assert.equal(result.confidence,"medium");
  assert.equal(result.matchSource,"fallback");
  assert.equal(result.confidenceScore,0.85);
}

{
  const existing=player({id:"p-name-only",name:"Name Only",normalized_name:"name only",mlb_team:"SEA",positions:["SS"]});
  const result=resolve([existing],{name:"Name Only",normalized_name:"name only"});
  assert.equal(result.action,"unmatched");
  assert.equal(result.confidence,"low");
  assert.equal(result.reason,"missing_stable_identifier_and_no_safe_fallback");
}

{
  const first=player({id:"p-same-1",name:"Same Name",normalized_name:"same name",mlb_team:"SEA",positions:["SS"]});
  const second=player({id:"p-same-2",name:"Same Name",normalized_name:"same name",mlb_team:"SEA",positions:["SS"]});
  const result=resolve([first,second],{name:"Same Name",normalized_name:"same name",mlb_team:"SEA",positions:["SS"]});
  assert.equal(result.action,"unmatched");
  assert.equal(result.matchSource,"fallback");
  assert.equal(result.reason,"ambiguous_fallback_match");
  assert.equal(result.candidates.length,2);
  result.candidates.forEach(assertCandidateShape);
}

{
  const result=resolve([],{fantrax_id:"FTX-INSERT",name:"New Stable",normalized_name:"new stable"});
  assert.equal(result.action,"insert");
  assert.equal(result.matchedPlayerId,null);
  assert.equal(result.confidence,"high");
  assert.equal(result.matchSource,"fantrax_id");
  assert.equal(result.confidenceScore,0.95);
}

{
  const result=resolve([],{mlbam_id:98765,name:"New MLBAM",normalized_name:"new mlbam"});
  assert.equal(result.action,"insert");
  assert.equal(result.matchedPlayerId,null);
  assert.equal(result.confidence,"high");
  assert.equal(result.matchSource,"mlbam_id");
  assert.equal(result.confidenceScore,0.93);
}

{
  const result=resolve([],{name:"No Identity",normalized_name:"no identity"});
  assert.equal(result.action,"unmatched");
  assert.equal(result.matchedPlayerId,null);
  assert.equal(result.confidence,"low");
  assert.equal(result.matchSource,null);
  assert.equal(result.diagnostics.incoming.normalizedName,"no identity");
  assert.equal(result.confidenceScore,0);
}

{
  const first=player({id:"p-dupe-ftx-1",fantrax_id:"FTX-DUPE"});
  const second=player({id:"p-dupe-ftx-2",fantrax_id:"FTX-DUPE"});
  const result=resolve([first,second],{fantrax_id:"FTX-DUPE"});
  assert.equal(result.action,"conflict");
  assert.equal(result.reason,"duplicate_existing_fantrax_id");
  assert.deepEqual(result.conflict.conflictingPlayerIds.sort(),["p-dupe-ftx-1","p-dupe-ftx-2"]);
  assert.equal(result.confidenceScore,0);
}

{
  const first=player({id:"p-dupe-mlbam-1",mlbam_id:55});
  const second=player({id:"p-dupe-mlbam-2",mlbam_id:55});
  const result=resolve([first,second],{mlbam_id:55});
  assert.equal(result.action,"conflict");
  assert.equal(result.reason,"duplicate_existing_mlbam_id");
  assert.deepEqual(result.conflict.conflictingPlayerIds.sort(),["p-dupe-mlbam-1","p-dupe-mlbam-2"]);
}

{
  const fantraxMatch=player({id:"p-ftx",fantrax_id:"FTX-CONFLICT"});
  const mlbamMatch=player({id:"p-mlb",mlbam_id:9191});
  const result=resolve([fantraxMatch,mlbamMatch],{fantrax_id:"FTX-CONFLICT",mlbam_id:9191});
  assert.equal(result.action,"conflict");
  assert.equal(result.reason,"fantrax_id_and_mlbam_id_match_different_players");
  assert.deepEqual(result.conflict.conflictingPlayerIds.sort(),["p-ftx","p-mlb"]);
}

{
  const stable=player({id:"p-stable",fantrax_id:"FTX-STABLE",name:"Stable Candidate",normalized_name:"stable candidate"});
  const fallback=player({id:"p-context",name:"Context Candidate",normalized_name:"context candidate",mlb_team:"BOS",positions:["2B"]});
  const result=resolve([stable,fallback],{fantrax_id:"FTX-STABLE",name:"Context Candidate",normalized_name:"context candidate",mlb_team:"BOS",positions:["2B"]});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-stable");
  assert.equal(result.matchSource,"fantrax_id");
  assert.equal(result.reason,"fantrax_id_match");
  assert.equal(result.diagnostics.candidateCounts.fallback,0);
  assert.ok(result.trace.includes("fallback_skipped_stable_id_present"));
}

{
  const stable=player({id:"p-stable-many",fantrax_id:"FTX-STABLE-MANY",name:"Stable Many",normalized_name:"stable many"});
  const fallbackA=player({id:"p-context-a",name:"Many Context",normalized_name:"many context",mlb_team:"BOS",positions:["2B"]});
  const fallbackB=player({id:"p-context-b",name:"Many Context",normalized_name:"many context",mlb_team:"BOS",positions:["2B"]});
  const result=resolve([stable,fallbackB,fallbackA],{fantrax_id:"FTX-STABLE-MANY",name:"Many Context",normalized_name:"many context",mlb_team:"BOS",positions:["2B"]});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-stable-many");
  assert.equal(result.matchSource,"fantrax_id");
  assert.equal(result.diagnostics.candidateCounts.fallback,0);
}

{
  const fallback=player({id:"p-context-blocked",name:"Context Candidate",normalized_name:"context candidate",mlb_team:"BOS",positions:["2B"]});
  const result=resolve([fallback],{fantrax_id:"FTX-NEW",name:"Context Candidate",normalized_name:"context candidate",mlb_team:"BOS",positions:["2B"]});
  assert.equal(result.action,"insert");
  assert.equal(result.matchSource,"fantrax_id");
  assert.equal(result.reason,"no_existing_stable_identifier_match");
  assert.equal(result.diagnostics.candidateCounts.fallback,0);
  assert.ok(result.trace.includes("fallback_skipped_stable_id_present"));
}

{
  const fallback=player({id:"p-context-blocked-mlbam",name:"Context Candidate",normalized_name:"context candidate",mlb_team:"BOS",positions:["2B"]});
  const result=resolve([fallback],{mlbam_id:876543,name:"Context Candidate",normalized_name:"context candidate",mlb_team:"BOS",positions:["2B"]});
  assert.equal(result.action,"insert");
  assert.equal(result.matchSource,"mlbam_id");
  assert.equal(result.reason,"no_existing_stable_identifier_match");
  assert.equal(result.diagnostics.candidateCounts.fallback,0);
  assert.ok(result.trace.includes("fallback_skipped_stable_id_present"));
}

{
  const existing=player({id:"p-accent",name:"Jose Ramirez Jr.",normalized_name:"jose ramirez jr",mlb_team:"CLE",positions:["3B"]});
  const result=resolve([existing],{name:"Jose Ramirez",normalized_name:"José Ramírez",mlb_team:"CLE",positions:["3B"]});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"p-accent");
  assert.equal(result.matchSource,"fallback");
}

{
  const existing=player({id:"p-empty-ids",fantrax_id:"",mlbam_id:"",name:"Empty IDs",normalized_name:"empty ids",mlb_team:"LAD",positions:["P"]});
  const result=resolve([existing],{fantrax_id:"   ",mlbam_id:" ",name:"Empty IDs",normalized_name:"empty ids"});
  assert.equal(result.action,"unmatched");
  assert.equal(result.reason,"missing_stable_identifier_and_no_safe_fallback");
}

{
  const badExisting={name:"Bad Existing",fantrax_id:"BAD-1"};
  const result=resolve([badExisting],{fantrax_id:"BAD-1"});
  assert.equal(result.action,"conflict");
  assert.equal(result.reason,"invalid_existing_player_identity");
  assert.equal(result.conflict.conflictingPlayerNames[0],"Bad Existing");
}

{
  const source={fantrax_id:"FTX-IMMUTABLE",name:"Immutable",normalized_name:"immutable",positions:["OF"]};
  const before=JSON.stringify(source);
  const result=resolve([],source);
  assert.equal(result.action,"insert");
  assert.equal(JSON.stringify(source),before);
}

{
  assert.equal(PlayerIdentityResolution.ACTIONS.UPDATE,"update");
  assert.equal(PlayerIdentityResolution.CONFIDENCE.MEDIUM,"medium");
  assert.equal(PlayerIdentityResolution.MATCH_SOURCE.FALLBACK,"fallback");
  assert.equal(PlayerIdentityResolution.REASONS.AMBIGUOUS_FALLBACK,"ambiguous_fallback_match");
  assert.equal(PlayerIdentityResolution.CONFIDENCE_SCORES.FANTRAX_UPDATE,1.00);
}

{
  const updateResult=resolve([player({id:"meta-update",fantrax_id:"META"})],{fantrax_id:"META"});
  const insertResult=resolve([],{fantrax_id:"META-INSERT"});
  const conflictResult=resolve([player({id:"meta-dupe-1",fantrax_id:"META-D"}),player({id:"meta-dupe-2",fantrax_id:"META-D"})],{fantrax_id:"META-D"});
  const unmatchedResult=resolve([],{name:"Meta None",normalized_name:"meta none"});
  [updateResult,insertResult,conflictResult,unmatchedResult].forEach(assertMetadata);
}

{
  const first=resolve([],{fantrax_id:"KEY-1",mlbam_id:12,name:"Key Player",normalized_name:"Key Player",mlb_team:"nyy",positions:["SS","2B"]});
  const second=resolve([],{fantrax_id:"KEY-1",mlbam_id:"12",name:"Key Player",normalized_name:"key player",mlb_team:"NYY",positions:["2B","SS"]});
  const third=resolve([],{fantrax_id:"KEY-2",mlbam_id:12,name:"Key Player",normalized_name:"Key Player",mlb_team:"nyy",positions:["SS","2B"]});
  assert.equal(first.resolutionKey,second.resolutionKey);
  assert.notEqual(first.resolutionKey,third.resolutionKey);
}

{
  const first=resolve([],{mlbam_id:999,name:"Trace Player",normalized_name:"trace player"});
  const second=resolve([],{mlbam_id:999,name:"Trace Player",normalized_name:"trace player"});
  assert.deepEqual(first.trace,second.trace);
  assert.deepEqual(first.trace,[
    "fantrax_id_missing",
    "mlbam_id_present",
    "mlbam_match_not_found",
    "mlbam_validation_complete",
    "fallback_skipped_stable_id_present",
    "fallback_validation_complete",
    "resolved_insert_by_mlbam_id"
  ]);
  first.trace.forEach(item=>assert.equal(item.includes("[object Object]"),false));
}

{
  const existing=player({id:"resilient-ftx",fantrax_id:"FTX-R",name:"Old Name",normalized_name:"old name",mlb_team:"NYY",positions:["OF"]});
  assert.equal(resolve([existing],{fantrax_id:"FTX-R",name:"New Name",normalized_name:"new name"}).matchedPlayerId,"resilient-ftx");
  assert.equal(resolve([existing],{fantrax_id:"FTX-R",name:"Old Name",normalized_name:"old name",mlb_team:"LAD"}).matchedPlayerId,"resilient-ftx");
  assert.equal(resolve([existing],{fantrax_id:"FTX-R",name:"Old Name",normalized_name:"old name",positions:["P"]}).matchedPlayerId,"resilient-ftx");
}

{
  const existing=player({id:"resilient-mlbam",mlbam_id:444,name:"Old MLBAM",normalized_name:"old mlbam"});
  assert.equal(resolve([existing],{mlbam_id:444,name:"New MLBAM",normalized_name:"new mlbam"}).matchedPlayerId,"resilient-mlbam");
  assert.equal(resolve([existing],{fantrax_id:null,mlbam_id:444}).matchedPlayerId,"resilient-mlbam");
  assert.equal(resolve([existing],{fantrax_id:"   ",mlbam_id:444}).matchedPlayerId,"resilient-mlbam");
  assert.equal(resolve([existing],{mlbam_id:"444"}).matchedPlayerId,"resilient-mlbam");
}

{
  const zeroExisting=player({id:"zero-mlbam",mlbam_id:0,name:"Zero MLBAM",normalized_name:"zero mlbam",mlb_team:"NYY",positions:["OF"]});
  const result=resolve([zeroExisting],{mlbam_id:0,name:"Zero MLBAM",normalized_name:"zero mlbam",mlb_team:"NYY",positions:["OF"]});
  assert.equal(result.action,"update");
  assert.equal(result.matchSource,"fallback");
  assert.equal(result.diagnostics.incoming.mlbamId,"");
  assert.ok(result.trace.includes("mlbam_id_missing"));
}

{
  const zeroExisting=player({id:"zero-mlbam-no-context",mlbam_id:0,name:"Zero MLBAM",normalized_name:"zero mlbam",mlb_team:"NYY",positions:["OF"]});
  const result=resolve([zeroExisting],{mlbam_id:0,name:"Different Zero",normalized_name:"different zero",mlb_team:"LAD",positions:["P"]});
  assert.equal(result.action,"unmatched");
  assert.equal(result.reason,"missing_stable_identifier_and_no_safe_fallback");
  assert.equal(result.diagnostics.incoming.mlbamId,"");
}

{
  const existing=player({id:"repo-existing",fantrax_id:"REPO-1"});
  const repository=new InMemoryPlayerIdentityRepository([existing]);
  assert.equal(new PlayerIdentityResolver({repository}).resolve({fantrax_id:"REPO-1"}).matchedPlayerId,"repo-existing");
  assert.equal(new PlayerIdentityResolver({existingPlayers:[existing]}).resolve({fantrax_id:"REPO-1"}).matchedPlayerId,"repo-existing");
}

{
  const repository={
    findByFantraxId:id=>id==="CUSTOM"?[player({id:"custom-repo",fantrax_id:"CUSTOM"})]:[],
    findByMlbamId:()=>[],
    findByNormalizedName:()=>[]
  };
  const result=new PlayerIdentityResolver({repository}).resolve({fantrax_id:"CUSTOM"});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"custom-repo");
}

{
  const repositoryRecord=player({id:"custom-no-mutate",fantrax_id:"CUSTOM-NM"});
  const before=JSON.stringify(repositoryRecord);
  const repository={
    findByFantraxId:id=>id==="CUSTOM-NM"?[repositoryRecord]:[],
    findByMlbamId:()=>[],
    findByNormalizedName:()=>[]
  };
  new PlayerIdentityResolver({repository}).resolve({fantrax_id:"CUSTOM-NM"});
  assert.equal(JSON.stringify(repositoryRecord),before);
}

{
  const repository=new InMemoryPlayerIdentityRepository([
    player({id:"repo-dupe-1",fantrax_id:"REPO-DUPE"}),
    player({id:"repo-dupe-2",fantrax_id:"REPO-DUPE"})
  ]);
  const result=new PlayerIdentityResolver({repository}).resolve({fantrax_id:"REPO-DUPE"});
  assert.equal(result.action,"conflict");
  assert.deepEqual(result.conflict.conflictingPlayerIds.sort(),["repo-dupe-1","repo-dupe-2"]);
}

{
  const repository=new InMemoryPlayerIdentityRepository([player({id:"defensive",fantrax_id:"DEF"})]);
  const first=repository.findByFantraxId("DEF");
  first.length=0;
  assert.equal(repository.findByFantraxId("DEF").length,1);
}

{
  const sourcePlayer=player({id:"no-mutate-existing",fantrax_id:"NM"});
  const existingPlayers=[sourcePlayer];
  const before=JSON.stringify(existingPlayers);
  const repository=new InMemoryPlayerIdentityRepository(existingPlayers);
  new PlayerIdentityResolver({repository}).resolve({fantrax_id:"NM"});
  assert.equal(JSON.stringify(existingPlayers),before);
  assert.equal(JSON.stringify(sourcePlayer),JSON.stringify(existingPlayers[0]));
}

{
  const first=player({id:"order-b",fantrax_id:"ORDER-D"});
  const second=player({id:"order-a",fantrax_id:"ORDER-D"});
  const result=resolve([first,second],{fantrax_id:"ORDER-D"});
  assert.deepEqual(result.conflict.candidates.map(candidate=>candidate.id),["order-a","order-b"]);
}

{
  const invalid={name:"Unrelated Invalid",fantrax_id:"BAD-ID"};
  const valid=player({id:"valid-despite-invalid",fantrax_id:"GOOD-ID"});
  const result=resolve([invalid,valid],{fantrax_id:"GOOD-ID"});
  assert.equal(result.action,"update");
  assert.equal(result.matchedPlayerId,"valid-despite-invalid");
  assert.ok(result.diagnostics.warnings.some(warning=>warning.includes("ignored_invalid_existing_player")));
}

{
  const invalid={name:"Relevant Invalid",fantrax_id:"REL-ID"};
  const result=resolve([invalid],{fantrax_id:"REL-ID"});
  assert.equal(result.action,"conflict");
  assert.equal(result.reason,"invalid_existing_player_identity");
  assert.equal(result.conflict.candidates[0].name,"Relevant Invalid");
}

{
  const invalid={name:"Relevant Fallback Invalid",normalized_name:"fallback invalid",mlb_team:"SEA",positions:["SS"]};
  const result=resolve([invalid],{name:"Fallback Invalid",normalized_name:"fallback invalid",mlb_team:"SEA",positions:["SS"]});
  assert.equal(result.action,"conflict");
  assert.equal(result.reason,"invalid_existing_player_identity");
}

console.log("PlayerIdentityResolver tests passed");
