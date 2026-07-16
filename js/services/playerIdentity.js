export function cleanExternalId(value){
  return String(value??"").trim();
}

export function cleanMlbamId(value){
  const cleaned=cleanExternalId(value);
  if(!cleaned||["0","nan","null","undefined"].includes(cleaned.toLowerCase()))return "";
  return cleaned;
}

export function normalizeIdentityName(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi,"")
    .replace(/[^a-z0-9]+/gi," ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g," ");
}

function positionSet(value){
  const values=Array.isArray(value)?value:String(value||"").split(/[\/,\s]+/);
  return new Set(values.map(v=>String(v||"").trim().toUpperCase()).filter(Boolean));
}

function positionOverlap(a,b){
  const left=positionSet(a),right=positionSet(b);
  if(!left.size||!right.size)return false;
  for(const value of left)if(right.has(value))return true;
  return false;
}

function teamValue(player){
  return String(player?.mlb_team||player?.mlbTeam||player?.org||player?.team||"").trim().toUpperCase();
}

function identityPlayerName(player){
  return player?.name||player?.player_name||player?.playerName||"";
}

function pushIndex(map,duplicates,key,player){
  if(!key)return;
  const rows=map.get(key)||[];
  rows.push(player);
  map.set(key,rows);
  if(rows.length>1)duplicates.add(key);
}

export function buildPlayerIdentityIndexes(players=[]){
  const indexes={
    byFantrax:new Map(),
    byMlbam:new Map(),
    byName:new Map(),
    duplicateFantrax:new Set(),
    duplicateMlbam:new Set(),
    duplicateNames:new Set()
  };
  players.forEach(player=>{
    pushIndex(indexes.byFantrax,indexes.duplicateFantrax,cleanExternalId(player.fantrax_id),player);
    pushIndex(indexes.byMlbam,indexes.duplicateMlbam,cleanMlbamId(player.mlbam_id),player);
    const nameKey=normalizeIdentityName(player.normalized_name||identityPlayerName(player));
    pushIndex(indexes.byName,indexes.duplicateNames,nameKey,player);
  });
  return indexes;
}

function fallbackCandidates(row,indexes){
  const nameKey=normalizeIdentityName(row.normalized_name||identityPlayerName(row));
  if(!nameKey)return [];
  const candidates=indexes.byName.get(nameKey)||[];
  return candidates.map(player=>{
    let score=1;
    const incomingTeam=teamValue(row);
    const candidateTeam=teamValue(player);
    if(incomingTeam&&candidateTeam&&incomingTeam===candidateTeam)score+=2;
    if(positionOverlap(row.positions||row.position,player.positions||player.position))score+=1;
    return {player,score};
  });
}

export function findCautiousFallback(row,indexes){
  const matches=fallbackCandidates(row,indexes).sort((a,b)=>b.score-a.score);
  if(!matches.length)return {status:"unmatched"};
  if(matches.length===1)return {status:"matched",player:matches[0].player};
  const contextualMatches=matches.filter(match=>match.score>=3);
  if(!contextualMatches.length)return {status:"ambiguous",players:matches.map(match=>match.player)};
  contextualMatches.sort((a,b)=>b.score-a.score);
  if(contextualMatches.length===1)return {status:"matched",player:contextualMatches[0].player};
  if(contextualMatches[0].score!==contextualMatches[1].score)return {status:"matched",player:contextualMatches[0].player};
  return {status:"ambiguous",players:contextualMatches.filter(match=>match.score===contextualMatches[0].score).map(match=>match.player)};
}

function conflictPayload({row,rowNumber,leagueId,reason,players=[]}){
  const uniquePlayers=[...new Map(players.filter(Boolean).map(player=>[player.id,player])).values()];
  return {
    sourceRowNumber:rowNumber,
    incomingPlayerName:identityPlayerName(row),
    incomingFantraxId:cleanExternalId(row.fantrax_id),
    incomingMlbamId:cleanMlbamId(row.mlbam_id),
    conflictingInternalPlayerUuids:uniquePlayers.map(player=>player.id).filter(Boolean),
    conflictingPlayerNames:uniquePlayers.map(player=>identityPlayerName(player)).filter(Boolean),
    leagueId:leagueId||row?.league_id||"",
    reason
  };
}

function uniqueId(player){
  return player?.id||"";
}

export function resolvePlayerIdentity(row,indexes,{leagueId=row?.league_id,rowNumber=0}={}){
  const fantraxId=cleanExternalId(row?.fantrax_id);
  const mlbamId=cleanMlbamId(row?.mlbam_id);
  const fantraxMatches=fantraxId?(indexes.byFantrax.get(fantraxId)||[]):[];
  const mlbamMatches=mlbamId?(indexes.byMlbam.get(mlbamId)||[]):[];

  if(fantraxMatches.length>1){
    return {status:"conflict",conflict:conflictPayload({row,rowNumber,leagueId,reason:"duplicate_existing_fantrax_id",players:fantraxMatches})};
  }
  if(mlbamMatches.length>1){
    return {status:"conflict",conflict:conflictPayload({row,rowNumber,leagueId,reason:"duplicate_existing_mlbam_id",players:mlbamMatches})};
  }
  if(fantraxMatches[0]&&mlbamMatches[0]&&uniqueId(fantraxMatches[0])!==uniqueId(mlbamMatches[0])){
    return {status:"conflict",conflict:conflictPayload({row,rowNumber,leagueId,reason:"fantrax_and_mlbam_match_different_players",players:[fantraxMatches[0],mlbamMatches[0]]})};
  }

  const stableMatch=fantraxMatches[0]||mlbamMatches[0]||null;
  const stableMatchType=fantraxMatches[0]?"fantrax":mlbamMatches[0]?"mlbam":"";
  const fallback=(!fantraxId&&!mlbamId)?findCautiousFallback(row,indexes):{status:"unmatched"};
  if(stableMatch&&fallback.status==="matched"&&uniqueId(stableMatch)!==uniqueId(fallback.player)){
    return {status:"conflict",conflict:conflictPayload({row,rowNumber,leagueId,reason:"stable_id_conflicts_with_name_context_candidate",players:[stableMatch,fallback.player]})};
  }
  if(stableMatch)return {status:"matched",player:stableMatch,matchType:stableMatchType};
  if(fallback.status==="matched")return {status:"matched",player:fallback.player,matchType:"fallback"};
  if(fallback.status==="ambiguous"){
    return {status:"conflict",conflict:conflictPayload({row,rowNumber,leagueId,reason:"ambiguous_name_context_fallback",players:fallback.players})};
  }
  return {status:"unmatched"};
}

function fallbackKey(row){
  const name=normalizeIdentityName(row.normalized_name||identityPlayerName(row));
  const team=teamValue(row);
  const positions=[...positionSet(row.positions||row.position)].sort().join("/");
  return name?`${row.league_id||""}:fallback:${name}:${team}:${positions}`:"";
}

export function dedupeIdentityRows(rows=[]){
  const unique=new Map();
  const seenFantrax=new Set();
  const seenMlbam=new Set();
  const seenFallback=new Set();
  const skippedInvalidRows=[];
  let duplicateFantraxIds=0,duplicateMlbamIds=0,duplicateFallbackKeys=0;

  rows.forEach((row,index)=>{
    if(!row?.league_id){
      skippedInvalidRows.push({index,rowNumber:index+1,name:identityPlayerName(row),reason:"missing league_id"});
      return;
    }
    const fantraxId=cleanExternalId(row.fantrax_id);
    const mlbamId=cleanMlbamId(row.mlbam_id);
    let key="";
    if(fantraxId){
      key=`${row.league_id}:fantrax:${fantraxId}`;
      if(seenFantrax.has(key))duplicateFantraxIds++;
      seenFantrax.add(key);
    }else if(mlbamId){
      key=`${row.league_id}:mlbam:${mlbamId}`;
      if(seenMlbam.has(key))duplicateMlbamIds++;
      seenMlbam.add(key);
    }else if(row.id){
      key=`${row.league_id}:uuid:${row.id}`;
    }else{
      key=fallbackKey(row);
      if(!key){
        skippedInvalidRows.push({index,rowNumber:index+1,name:identityPlayerName(row),reason:"missing identity fields"});
        return;
      }
      if(seenFallback.has(key))duplicateFallbackKeys++;
      seenFallback.add(key);
    }
    unique.set(key,{...row,fantrax_id:fantraxId||undefined,mlbam_id:mlbamId||null});
  });

  return {
    rows:[...unique.values()],
    sourceRows:rows.length,
    rowsAfterDeduplication:unique.size,
    duplicateFantraxIds,
    duplicateMlbamIds,
    duplicateFallbackKeys,
    skippedInvalidRows
  };
}
