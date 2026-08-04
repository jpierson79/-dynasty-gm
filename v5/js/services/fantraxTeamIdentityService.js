const clean=value=>String(value??"").trim();
const normalizeName=value=>clean(value).toUpperCase().replace(/&/g," AND ").replace(/[^A-Z0-9]+/g," ").replace(/\s+/g," ").trim();
export const validFantraxTeamId=value=>/^[A-Za-z0-9]{16}$/.test(clean(value));

export function teamIdentitySuggestion(fantraxTeam,cloudTeams=[]){
  const matches=cloudTeams.filter(team=>normalizeName(team.name)===normalizeName(fantraxTeam.teamName));
  return matches.length===1?matches[0].id:"";
}

export function validatePendingTeamMappings({leagueId,fantraxTeams=[],cloudTeams=[],pendingMappings={},allowReplacement=false}={}){
  const fantraxById=new Map(fantraxTeams.map(team=>[clean(team.fantraxTeamId),team]));
  const cloudById=new Map(cloudTeams.map(team=>[clean(team.id),team]));
  const usedCloud=new Set(),errors=[];
  for(const [fantraxTeamId,cloudTeamId] of Object.entries(pendingMappings)){
    const externalId=clean(fantraxTeamId),teamId=clean(cloudTeamId),cloudTeam=cloudById.get(teamId);
    if(!validFantraxTeamId(externalId)||!fantraxById.has(externalId))errors.push(`Unknown or invalid Fantrax team ID: ${externalId||"(blank)"}.`);
    if(!cloudTeam||clean(cloudTeam.league_id)!==clean(leagueId))errors.push(`Cloud team ${teamId||"(blank)"} is outside the active league.`);
    if(usedCloud.has(teamId))errors.push(`Cloud team ${teamId} is selected more than once.`);
    usedCloud.add(teamId);
    const existing=clean(cloudTeam?.fantrax_team_id);
    if(existing&&existing!==externalId&&!allowReplacement)errors.push(`${cloudTeam.name||teamId} already has a different Fantrax team ID; replacement requires confirmation.`);
    const authoritativeOwner=cloudTeams.find(team=>clean(team.fantrax_team_id)===externalId&&clean(team.id)!==teamId);
    if(authoritativeOwner)errors.push(`Fantrax team ID ${externalId} is already mapped to ${authoritativeOwner.name||authoritativeOwner.id}.`);
  }
  const existingIds=new Map();
  cloudTeams.forEach(team=>{const id=clean(team.fantrax_team_id);if(id){if(!existingIds.has(id))existingIds.set(id,[]);existingIds.get(id).push(team.id)}});
  existingIds.forEach((ids,id)=>{if(ids.length>1)errors.push(`Fantrax team ID ${id} is already duplicated.`)});
  return {valid:errors.length===0,errors,mappingCount:Object.keys(pendingMappings).length};
}

export function setPendingTeamMapping(pendingMappings,fantraxTeamId,cloudTeamId){
  const next={...(pendingMappings||{})},externalId=clean(fantraxTeamId),teamId=clean(cloudTeamId);
  if(teamId)next[externalId]=teamId;else delete next[externalId];
  return next;
}

export function teamMappingSaveRows({leagueId,cloudTeams=[],pendingMappings={}}={}){
  const byId=new Map(cloudTeams.map(team=>[clean(team.id),team]));
  return Object.entries(pendingMappings).map(([fantraxTeamId,teamId])=>({id:clean(teamId),league_id:clean(leagueId),fantrax_team_id:clean(fantraxTeamId),current_fantrax_team_id:clean(byId.get(clean(teamId))?.fantrax_team_id)}));
}
