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
  const assigned=rows.filter(row=>row.manager_id&&managers.some(manager=>manager.id===row.manager_id));
  const unassigned=rows.filter(row=>!assigned.some(item=>item.id===row.id));
  const managerGuidance=managers.length
    ?`<p class="note">${assigned.length} assigned team${assigned.length===1?"":"s"}; ${unassigned.length} unassigned. Select one team and one existing manager below. A manager can be linked only by UUID.</p>`
    :`<section class="message-panel active"><b>No manager intelligence rows are available.</b><p class="note">Import a reviewed Manager Intelligence JSON file from Cloud Imports, then return here to assign existing managers to teams. No manager records are fabricated by this screen.</p></section>`;
  return `<section class="view-panel"><h2>Teams & Managers</h2><div class="grid"><div class="metric"><span>Managers</span><b>${managers.length}</b></div><div class="metric"><span>Assigned teams</span><b>${assigned.length}</b></div><div class="metric"><span>Unassigned teams</span><b>${unassigned.length}</b></div></div><p class="note">Players is total owned roster count. Active, Reserve, IL, Minors, and Unclassified are mutually exclusive normalized roster groups; Minor League and IL counts are included in Players.</p>${table([
    {label:"Team",value:"name"},
    {label:"Manager",value:"managerName"},
    {label:"Players",value:"playerCount"},
    {label:"Active",value:"active"},
    {label:"Reserve",value:"reserve"},
    {label:"IL",value:"il"},
    {label:"Minors",value:"minors"},
    {label:"Unclassified",value:"unclassified"}
  ],rows)}<h3>Manager assignments</h3>${managerGuidance}<div class="toolbar"><label>Unassigned team<select id="linkTeam"${unassigned.length&&managers.length?"":" disabled"}><option value="">Select team</option>${unassigned.map(team=>optionHtml(team.id,team.name)).join("")}</select></label><label>Existing manager<select id="linkManager"${managers.length?"":" disabled"}><option value="">Select manager</option>${managers.map(manager=>optionHtml(manager.id,manager.manager_name||manager.team_name)).join("")}</select></label><button type="button" id="linkManagerButton" class="primary"${unassigned.length&&managers.length?"":" disabled"}>Assign Manager</button></div></section>`;
}
