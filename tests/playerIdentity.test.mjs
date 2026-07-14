import assert from "node:assert/strict";
import {
  buildPlayerIdentityIndexes,
  cleanExternalId,
  dedupeIdentityRows,
  resolvePlayerIdentity
} from "../js/services/playerIdentity.js";

const leagueId="11111111-1111-1111-1111-111111111111";

function player(patch){
  return {
    id:crypto.randomUUID(),
    league_id:leagueId,
    name:"Test Player",
    normalized_name:"test player",
    positions:["OF"],
    mlb_team:"NYY",
    ...patch
  };
}

function resolve(row,players){
  return resolvePlayerIdentity({league_id:leagueId,positions:["OF"],mlb_team:"NYY",...row},buildPlayerIdentityIndexes(players),{leagueId,rowNumber:2});
}

{
  const existing=player({id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",fantrax_id:"FTX-42",name:"Luis Garcia",normalized_name:"luis garcia"});
  const result=resolve({fantrax_id:"FTX-42",name:"Luis Garcia",normalized_name:"luis garcia"},[existing]);
  assert.equal(result.status,"matched");
  assert.equal(result.matchType,"fantrax");
  assert.equal(result.player.id,existing.id);
}

{
  const rows=[
    {league_id:leagueId,fantrax_id:"FTX-1",name:"First",normalized_name:"first"},
    {league_id:leagueId,fantrax_id:"FTX-1",name:"First Updated",normalized_name:"first updated"}
  ];
  const deduped=dedupeIdentityRows(rows);
  assert.equal(deduped.rowsAfterDeduplication,1);
  assert.equal(deduped.duplicateFantraxIds,1);
  assert.equal(deduped.rows[0].name,"First Updated");
}

{
  const existing=player({id:"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",fantrax_id:"FTX-99",name:"Old Name",normalized_name:"old name"});
  const result=resolve({fantrax_id:"FTX-99",name:"New Name",normalized_name:"new name"},[existing]);
  assert.equal(result.status,"matched");
  assert.equal(result.player.id,existing.id);
}

{
  const first=player({id:"cccccccc-cccc-cccc-cccc-cccccccccccc",name:"Jose Ramirez",normalized_name:"jose ramirez",fantrax_id:"FTX-A",mlb_team:"CLE",positions:["3B"]});
  const second=player({id:"dddddddd-dddd-dddd-dddd-dddddddddddd",name:"Jose Ramirez",normalized_name:"jose ramirez",fantrax_id:"FTX-B",mlb_team:"ATL",positions:["P"]});
  assert.equal(resolve({fantrax_id:"FTX-A",name:"Jose Ramirez",normalized_name:"jose ramirez",mlb_team:"CLE",positions:["3B"]},[first,second]).player.id,first.id);
  assert.equal(resolve({fantrax_id:"FTX-B",name:"Jose Ramirez",normalized_name:"jose ramirez",mlb_team:"ATL",positions:["P"]},[first,second]).player.id,second.id);
}

{
  const nameCandidate=player({id:"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",name:"Same Name",normalized_name:"same name",mlb_team:"BOS"});
  const fantraxCandidate=player({id:"ffffffff-ffff-ffff-ffff-ffffffffffff",fantrax_id:"FTX-7",name:"Different Name",normalized_name:"different name"});
  const result=resolve({fantrax_id:"FTX-7",name:"Same Name",normalized_name:"same name",mlb_team:"BOS"},[nameCandidate,fantraxCandidate]);
  assert.equal(result.status,"conflict");
  assert.equal(result.conflict.reason,"stable_id_conflicts_with_name_context_candidate");
}

{
  const existing=player({id:"12121212-1212-1212-1212-121212121212",mlbam_id:777,name:"MLBAM Player",normalized_name:"mlbam player"});
  const result=resolve({mlbam_id:777,name:"MLBAM Player",normalized_name:"mlbam player"},[existing]);
  assert.equal(result.status,"matched");
  assert.equal(result.matchType,"mlbam");
  assert.equal(result.player.id,existing.id);
}

{
  const fantraxMatch=player({id:"13131313-1313-1313-1313-131313131313",fantrax_id:"FTX-13",name:"A"});
  const mlbamMatch=player({id:"14141414-1414-1414-1414-141414141414",mlbam_id:1314,name:"B"});
  const result=resolve({fantrax_id:"FTX-13",mlbam_id:1314,name:"Incoming"},[fantraxMatch,mlbamMatch]);
  assert.equal(result.status,"conflict");
  assert.equal(result.conflict.reason,"fantrax_and_mlbam_match_different_players");
  assert.deepEqual(result.conflict.conflictingInternalPlayerUuids.sort(),[fantraxMatch.id,mlbamMatch.id].sort());
}

{
  assert.equal(cleanExternalId("  FTX-55  "),"FTX-55");
  const result=resolve({fantrax_id:"FTX-55",name:"Missing MLBAM",normalized_name:"missing mlbam"},[]);
  assert.equal(result.status,"unmatched");
}

{
  const noteLinkedPlayer=player({id:"15151515-1515-1515-1515-151515151515",fantrax_id:"FTX-NOTE",notes:"Keep this note"});
  const result=resolve({fantrax_id:"FTX-NOTE",name:"Updated Note Player",normalized_name:"updated note player"},[noteLinkedPlayer]);
  assert.equal(result.player.id,noteLinkedPlayer.id);
  assert.equal(result.player.notes,"Keep this note");
}

console.log("playerIdentity tests passed");
