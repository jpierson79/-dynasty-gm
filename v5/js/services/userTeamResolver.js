import { ENGINE_VERSION } from "../engine/dynastyEngine.js";
import { isValidFantasyTeam } from "../domain/teamRules.js";

export const USER_TEAM_RESOLUTION_VERSION="5.4.2";

function same(value,expected){return String(value||"")===String(expected||"")}
function token(value){return String(value||"").replace(/&/g," AND ").replace(/\s+/g," ").trim().toUpperCase()}
function unique(rows){return rows.length===1?rows[0]:null}
function isLeagueTeam(team,leagueId){return team?.id&&same(team.league_id,leagueId)}
function validTeam(team,leagueId){return isLeagueTeam(team,leagueId)&&isValidFantasyTeam(team)}
function isUserTeamAssociation(team){return team?.is_user_team===true}
function teamSummary(team){
  return team?{id:team.id,name:team.name||"",abbreviation:team.abbreviation||"",manager_id:team.manager_id||"",is_user_team:team.is_user_team===true,league_id:team.league_id||""}:null;
}

export function resolveUserFantasyTeam({leagueId,authenticatedUserId,preferredTeamId="",leagueRows=[],membershipRows=[],teamRows=[],playerRows=[],scoreRows=[],scoreVersion=ENGINE_VERSION,fallbackTeamTokens=[]}={}){
  const validTeams=teamRows.filter(team=>validTeam(team,leagueId));
  const userAssociatedTeams=validTeams.filter(isUserTeamAssociation);
  const league=leagueRows.find(row=>same(row.id,leagueId))||null;
  const userMembershipRows=membershipRows.filter(row=>same(row.user_id,authenticatedUserId)&&same(row.league_id,leagueId));
  const ownerMembershipRows=userMembershipRows.filter(row=>row.role==="owner");
  const preferred=validTeams.find(team=>same(team.id,preferredTeamId))||null;
  const canonicalAssociatedTeam=unique(userAssociatedTeams);
  const preferredBelongsToUser=Boolean(preferred&&canonicalAssociatedTeam&&same(preferred.id,canonicalAssociatedTeam.id));
  const reasons=[];
  let team=null,source="unresolved";
  if(preferredTeamId&&!preferred)reasons.push("preferred team UUID is not a valid fantasy team in this league");
  if(preferred&&!preferredBelongsToUser)reasons.push("preferred team UUID is valid but is not linked to the authenticated user");
  if(preferredBelongsToUser){team=preferred;source="preferred_user_team_uuid"}
  if(!team&&(same(league?.owner_user_id,authenticatedUserId)||ownerMembershipRows.length)){
    const ownerTeam=canonicalAssociatedTeam;
    if(ownerTeam){team=ownerTeam;source="owner_membership_user_team"}
  }
  if(!team){
    if(canonicalAssociatedTeam){team=canonicalAssociatedTeam;source="canonical_user_team_association"}
  }
  if(!team){
    const onlyTeam=unique(validTeams);
    if(onlyTeam){team=onlyTeam;source="unique_valid_team_fallback";reasons.push("used unique valid team fallback because no explicit user-team association exists")}
  }
  if(!team&&fallbackTeamTokens.length){
    const fallbackTokens=new Set(fallbackTeamTokens.map(token).filter(Boolean));
    const fallbackMatches=validTeams.filter(team=>fallbackTokens.has(token(team.name))||fallbackTokens.has(token(team.abbreviation)));
    const fallbackTeam=unique(fallbackMatches);
    if(fallbackTeam){team=fallbackTeam;source="unambiguous_name_code_fallback";reasons.push("used final unambiguous team name/code fallback because no UUID user-team association exists")}
  }
  const ownedPlayers=team?playerRows.filter(player=>same(player.owner_team_id,team.id)):[];
  const currentScoreIds=new Set(scoreRows.filter(score=>same(score.score_version,scoreVersion)).map(score=>score.player_id));
  const scoredOwnedPlayers=ownedPlayers.filter(player=>currentScoreIds.has(player.id));
  const rosterStatusCounts=ownedPlayers.reduce((counts,player)=>{
    const key=String(player.roster_status||"UNCLASSIFIED").toUpperCase()||"UNCLASSIFIED";
    counts[key]=(counts[key]||0)+1;
    return counts;
  },{});
  return {
    resolutionVersion:USER_TEAM_RESOLUTION_VERSION,
    leagueId,
    authenticatedUserId,
    preferredTeamId:preferredTeamId||"",
    rejectedPreferredTeamId:preferredTeamId&&(!preferred||!preferredBelongsToUser)&&!same(team?.id,preferredTeamId)?preferredTeamId:"",
    valid:Boolean(team),
    source,
    teamId:team?.id||"",
    team:teamSummary(team),
    reasons,
    diagnostics:{
      leagueId,
      authenticatedUserId,
      membershipRows:userMembershipRows,
      ownerMembershipRows,
      validTeamAssociations:validTeams.map(teamSummary),
      userTeamAssociations:userAssociatedTeams.map(teamSummary),
      associationStatus:userAssociatedTeams.length===1?"explicit":userAssociatedTeams.length?"ambiguous":"missing",
      fallbackTeamTokens:fallbackTeamTokens.map(token).filter(Boolean),
      canonicalUserTeam:teamSummary(team),
      ownedPlayerCount:ownedPlayers.length,
      scoredOwnedPlayerCount:scoredOwnedPlayers.length,
      missingCurrentScoreCount:Math.max(0,ownedPlayers.length-scoredOwnedPlayers.length),
      rosterStatusCounts,
      firstOwnedPlayers:ownedPlayers.slice(0,25).map(player=>({
        id:player.id,
        name:player.name||"",
        owner_team_id:player.owner_team_id||"",
        scorePresent:currentScoreIds.has(player.id),
        scoreVersion:currentScoreIds.has(player.id)?scoreVersion:""
      }))
    }
  };
}
