import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveStatcastPlayer, supplementalPlayerMatch } from "../js/services/cloudCsvImportService.js";
import { buildPlayerIdentityIndexes, normalizeIdentityName } from "../js/services/playerIdentity.js";

const leagueId="11111111-1111-4111-8111-111111111111";

function player(patch){
  return {
    id:crypto.randomUUID(),
    league_id:leagueId,
    name:"Test Player",
    normalized_name:"test player",
    fantrax_id:"",
    mlbam_id:null,
    ...patch
  };
}

function mapsFor(players){
  const playersByName=new Map();
  const ambiguousNames=new Set();
  const playersByMlbam=new Map();
  const playersByFantrax=new Map();
  players.forEach(p=>{
    const key=normalizeIdentityName(p.normalized_name||p.name);
    if(!key)return;
    if(playersByName.has(key))ambiguousNames.add(key);
    else playersByName.set(key,p);
    if(p.mlbam_id)playersByMlbam.set(String(p.mlbam_id),p);
    if(p.fantrax_id)playersByFantrax.set(String(p.fantrax_id),p);
  });
  return {players,identityIndexes:buildPlayerIdentityIndexes(players),playersByName,ambiguousNames,playersByMlbam,playersByFantrax};
}

{
  const existing=player({id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",name:"Juan Soto",normalized_name:"juan soto"});
  const matched=supplementalPlayerMatch(mapsFor([existing]),{
    league_id:leagueId,
    mlbam_id:665742,
    name:"Juan Soto",
    normalized_name:"juan soto"
  });
  assert.equal(matched.id,existing.id,"Statcast rows may match an unambiguous cloud player by exact normalized name when MLBAM is missing in cloud");
}

{
  const existing=player({id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",name:"Jose Ramirez",normalized_name:"jose ramirez"});
  const matched=supplementalPlayerMatch(mapsFor([existing]),{
    league_id:leagueId,
    name:"José Ramírez Jr.",
    normalized_name:"José Ramírez Jr."
  });
  assert.equal(matched.id,existing.id,"Supplemental matching should use shared name normalization for accents and suffixes");
}

{
  const left=player({id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",name:"Luis Garcia",normalized_name:"luis garcia"});
  const right=player({id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",name:"Luis Garcia",normalized_name:"luis garcia"});
  const matched=supplementalPlayerMatch(mapsFor([left,right]),{
    league_id:leagueId,
    name:"Luis Garcia",
    normalized_name:"luis garcia"
  });
  assert.equal(matched,null,"Supplemental matching must not guess between duplicate normalized names");
}

{
  const existing=player({id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",name:"Corbin Carroll",normalized_name:"corbin carroll",mlbam_id:682998});
  const matched=supplementalPlayerMatch(mapsFor([existing]),{
    league_id:leagueId,
    mlbam_id:999999,
    name:"Corbin Carroll",
    normalized_name:"corbin carroll"
  });
  assert.equal(matched,null,"Supplemental matching must not override a conflicting existing MLBAM ID");
}

{
  const existing=player({id:"ffffffff-ffff-4fff-8fff-ffffffffffff",name:"Mookie Betts",normalized_name:"mookie betts",mlbam_id:605141});
  const matched=supplementalPlayerMatch(mapsFor([existing]),{
    league_id:leagueId,
    mlbam_id:605141,
    name:"Different Name",
    normalized_name:"different name"
  });
  assert.equal(matched.id,existing.id,"Stable MLBAM matches should still win before supplemental name matching");
}

{
  const existing=player({id:"11111111-2222-4333-8444-555555555555",name:"Julio Rodriguez",normalized_name:"julio rodriguez",mlbam_id:null});
  const resolved=resolveStatcastPlayer(mapsFor([existing]),{league_id:leagueId,mlbam_id:677594,name:"Julio Rodriguez",normalized_name:"julio rodriguez"});
  assert.equal(resolved.status,"matched");
  assert.equal(resolved.player.id,existing.id);
  assert.equal(resolved.matchSource,"unambiguous_name","Statcast may safely match a null-MLBAM cloud player by unambiguous name for backfill");
}

{
  const existing=player({id:"22222222-2222-4333-8444-555555555555",name:"Kyle Tucker",normalized_name:"kyle tucker",mlbam_id:663656});
  const resolved=resolveStatcastPlayer(mapsFor([existing]),{league_id:leagueId,mlbam_id:999999,name:"Kyle Tucker",normalized_name:"kyle tucker"});
  assert.equal(resolved.status,"conflict","Conflicting Statcast MLBAM IDs must be preserved and reported");
}

{
  const fantraxMatch=player({id:"22222222-aaaa-4333-8444-555555555555",name:"Fantrax Player",normalized_name:"fantrax player",fantrax_id:"FTX-1",mlbam_id:null});
  const mlbamMatch=player({id:"22222222-bbbb-4333-8444-555555555555",name:"MLBAM Player",normalized_name:"mlbam player",mlbam_id:999999});
  const resolved=resolveStatcastPlayer(mapsFor([fantraxMatch,mlbamMatch]),{league_id:leagueId,fantrax_id:"FTX-1",mlbam_id:999999,name:"Fantrax Player",normalized_name:"fantrax player"});
  assert.equal(resolved.status,"conflict","Statcast Fantrax and MLBAM matches that point at different players must be reported");
}

{
  const left=player({id:"33333333-2222-4333-8444-555555555555",name:"Luis Garcia",normalized_name:"luis garcia",mlbam_id:null});
  const right=player({id:"44444444-2222-4333-8444-555555555555",name:"Luis Garcia",normalized_name:"luis garcia",mlbam_id:null});
  const resolved=resolveStatcastPlayer(mapsFor([left,right]),{league_id:leagueId,mlbam_id:671277,name:"Luis Garcia",normalized_name:"luis garcia"});
  assert.equal(resolved.status,"ambiguous","Ambiguous Statcast names must not backfill MLBAM IDs");
}

{
  const existing=player({id:"55555555-2222-4333-8444-555555555555",name:"Invalid ID",normalized_name:"invalid id",mlbam_id:null});
  const resolved=resolveStatcastPlayer(mapsFor([existing]),{league_id:leagueId,mlbam_id:"0",name:"Invalid ID",normalized_name:"invalid id"});
  assert.equal(resolved.status,"matched");
  assert.equal(resolved.matchSource,"unambiguous_name");
  assert.equal(resolved.player.mlbam_id,null,"Invalid Statcast player_id values are normalized to null and do not become MLBAM 0");
}

const importService=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");
assert.match(importService,/import \{ buildPlayerIdentityIndexes, cleanExternalId, cleanMlbamId, normalizeIdentityName, resolvePlayerIdentity \} from "\.\/playerIdentity\.js";/);
assert.match(importService,/createHkbPlayerMatcher/);
assert.match(importService,/classifyHkbRows/);
assert.match(importService,/reviewedPreview\.hkbDecisions/);
assert.match(importService,/const playerId=serializeMlbamId\(cell\(row,playerIx\)\),name=statcastName\(row,map\),fantraxId=textCell\(row,fantraxIx\)/);
assert.match(importService,/const resolved=resolveStatcastPlayer\(maps,\{league_id:leagueId,fantrax_id:fantraxId,mlbam_id:playerId/);
assert.match(importService,/cloudStore\.syncResolvedPlayers\(\{updates:\[\.\.\.mlbamBackfillRows\.values\(\)\],inserts:\[\]\}/);
assert.match(importService,/mlbamBackfilled/);
assert.match(importService,/mlbamConflicts/);
assert.match(importService,/matchedByUnambiguousName/);

console.log("supplementalImportMatching tests passed");
