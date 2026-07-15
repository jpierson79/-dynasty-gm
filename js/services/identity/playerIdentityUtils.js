export const RESOLVER_VERSION="2.0";

export function cleanExternalId(value){
  return String(value??"").trim();
}

export function cleanMlbamId(value){
  const cleaned=cleanExternalId(value);
  if(!cleaned||cleaned==="0")return "";
  return cleaned;
}

export function normalizeName(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi,"")
    .replace(/[^a-z0-9]+/gi," ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g," ");
}

export function normalizeTeam(value){
  return cleanExternalId(value).toUpperCase();
}

export function normalizePositions(value){
  const values=Array.isArray(value)?value:String(value||"").split(/[\/,\s]+/);
  return [...new Set(values.map(item=>cleanExternalId(item).toUpperCase()).filter(Boolean))].sort();
}

export function positionsOverlap(leftValue,rightValue){
  const left=new Set(normalizePositions(leftValue));
  const right=new Set(normalizePositions(rightValue));
  if(!left.size||!right.size)return false;
  for(const value of left)if(right.has(value))return true;
  return false;
}

export function playerName(player){
  return player?.name||player?.player_name||player?.playerName||"";
}

export function playerId(player){
  return cleanExternalId(player?.id);
}

export function playerTeam(player){
  return normalizeTeam(player?.mlb_team||player?.mlbTeam||player?.organization||player?.org||player?.team);
}

export function playerPositions(player){
  return normalizePositions(player?.positions||player?.position);
}

export function playerNormalizedName(player){
  return normalizeName(player?.normalized_name||player?.normalizedName||playerName(player));
}

export function incomingIdentitySummary(player){
  return Object.freeze({
    name:playerName(player),
    normalizedName:playerNormalizedName(player),
    fantraxId:cleanExternalId(player?.fantrax_id||player?.fantraxId),
    mlbamId:cleanMlbamId(player?.mlbam_id||player?.mlbamId),
    team:playerTeam(player),
    positions:playerPositions(player)
  });
}

export function candidateIdentitySummary(player){
  return Object.freeze({
    id:playerId(player),
    name:playerName(player),
    normalizedName:playerNormalizedName(player),
    fantraxId:cleanExternalId(player?.fantrax_id||player?.fantraxId),
    mlbamId:cleanMlbamId(player?.mlbam_id||player?.mlbamId),
    team:playerTeam(player),
    positions:playerPositions(player)
  });
}

export function fallbackIdentityKey(player){
  const summary=incomingIdentitySummary(player);
  return `${summary.normalizedName}|${summary.team}|${summary.positions.join("/")}`;
}

export function createResolutionKey(player){
  const summary=incomingIdentitySummary(player);
  return [
    `fantrax:${summary.fantraxId}`,
    `mlbam:${summary.mlbamId}`,
    `name:${summary.normalizedName}`,
    `team:${summary.team}`,
    `positions:${summary.positions.join("/")}`
  ].join("|");
}

export function sortCandidateSummaries(candidates){
  return [...candidates].sort((a,b)=>
    a.id.localeCompare(b.id)||
    a.name.localeCompare(b.name)||
    a.fantraxId.localeCompare(b.fantraxId)||
    a.mlbamId.localeCompare(b.mlbamId)
  );
}

export function cloneSummary(summary){
  return Object.freeze({
    ...summary,
    positions:[...(summary.positions||[])]
  });
}
