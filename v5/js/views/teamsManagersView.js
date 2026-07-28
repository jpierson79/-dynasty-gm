import { table } from "../components/table.js";
import { optionHtml } from "../utils/dom.js";
import { normalizeRosterStatus } from "../domain/rosterStatus.js";

export function renderTeamsManagers(state){
  const teams=state.teams||[],managers=state.managers||[],players=state.rosterSummary||[];
  const rows=teams.map(team=>{
    const roster=players.filter(player=>player.owner_team_id===team.id);
    const manager=managers.find(item=>item.id===team.manager_id);
    const countStatus=status=>roster.filter(player=>normalizeRosterStatus(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status})===status).length;
    return {...team,managerName:manager?.manager_name||manager?.team_name||"Unassigned.",playerCount:roster.length,active:countStatus("ACTIVE"),reserve:countStatus("RESERVE"),il:countStatus("IL"),minors:countStatus("MINORS"),unclassified:countStatus("UNCLASSIFIED")};
  });
  return `<section class="view-panel"><h2>Teams & Managers</h2>${table([
    {label:"Team",value:"name"},
    {label:"Manager",value:"managerName"},
    {label:"Players",value:"playerCount"},
    {label:"Active",value:"active"},
    {label:"Reserve",value:"reserve"},
    {label:"IL",value:"il"},
    {label:"Minors",value:"minors"},
    {label:"Unclassified",value:"unclassified"}
  ],rows)}<h3>Team-manager linking editor</h3><div class="toolbar"><label>Team<select id="linkTeam">${teams.map(team=>optionHtml(team.id,team.name)).join("")}</select></label><label>Manager<select id="linkManager">${managers.map(manager=>optionHtml(manager.id,manager.manager_name||manager.team_name)).join("")}</select></label><button id="linkManagerButton" class="primary">Link Manager</button></div></section>`;
}
