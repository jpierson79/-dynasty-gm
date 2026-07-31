import { table } from "../components/table.js";
import { optionHtml } from "../utils/dom.js";
import { rosterGroupLabel } from "../domain/rosterStatus.js";
import { groupedRecommendations } from "./recommendationComponents.js";

function groupName(player){
  return rosterGroupLabel(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status});
}
export function renderMyRoster(state){
  const teams=state.teams||[];
  const selectedTeamId=state.userTeamResolution?.teamId||"";
  const roster=selectedTeamId?(state.rosterPlayers||[]):[];
  const groups=["Active","Reserve","IL","Minors","Unclassified"];
  const selector=`<div class="toolbar"><label>User fantasy team<select id="myTeamSelect"><option value="">Select team</option>${teams.map(team=>optionHtml(team.id,team.name,selectedTeamId)).join("")}</select></label></div>`;
  if(!selectedTeamId)return `<section class="view-panel"><h2>My Roster</h2>${selector}<p class="note">Choose your fantasy team. V5 stores only the selected team ID as a lightweight preference.</p></section>`;
  const recommendations=state.rosterRecommendations?.recommendations||[];
  return `<section class="view-panel"><h2>My Roster</h2>${selector}<p class="note">Total roster count: ${roster.length}</p><section class="panel"><h3>Recommendations</h3><div class="toolbar"><button id="refreshRosterRecommendations" class="secondary">Refresh Recommendations</button></div><p class="note">${state.rosterRecommendationsLoading?"Loading recommendations...":state.rosterRecommendationsError?`Recommendation query failed: ${state.rosterRecommendationsError}`:`Rule ${state.rosterRecommendations?.decisionRuleVersion||"5.4.5"}. Recommendations use stored scores and roster context only.`}</p>${recommendations.length?groupedRecommendations(recommendations):"<p class='note'>Refresh recommendations after selecting your team.</p>"}</section><div class="grid">${groups.map(group=>`<div class="metric"><span>${group}</span><b>${roster.filter(player=>groupName(player)===group).length}</b></div>`).join("")}</div>${groups.map(group=>`<h3>${group}</h3>${table([
    {label:"Name",value:"name"},
    {label:"Position",value:row=>Array.isArray(row.positions)?row.positions.join("/"):""},
    {label:"MLB org",value:"mlb_team"},
    {label:"Roster status",value:"roster_status"},
    {label:"HKB",value:"hkb_value"}
  ],roster.filter(player=>groupName(player)===group))}`).join("")}</section>`;
}
