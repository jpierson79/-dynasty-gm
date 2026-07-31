import { NORMALIZED_ROSTER_STATUSES, normalizeRosterStatus } from "../domain/rosterStatus.js";

export const ROSTER_STATUS_MANAGER_VERSION="5.4.4";
export const EDITABLE_ROSTER_STATUSES=NORMALIZED_ROSTER_STATUSES.filter(status=>status!=="FREE_AGENT");

function same(value,expected){return String(value||"")===String(expected||"")}
function text(value){return String(value||"").toUpperCase()}
function positionTokens(player){return Array.isArray(player.positions)?player.positions:String(player.positions||"").split(/[\/,\s]+/)}
function ownerName(player,teams=[]){
  if(!player.owner_team_id)return "Free Agent";
  return player.teams?.name||teams.find(team=>team.id===player.owner_team_id)?.name||"Unknown owner";
}
export function editableStatus(value){
  const status=String(value||"").trim().toUpperCase();
  return EDITABLE_ROSTER_STATUSES.includes(status)?status:"";
}
export function currentRosterStatus(player){
  return normalizeRosterStatus(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status});
}
export function rosterStatusManagerRows(players=[],teams=[]){
  return players.map(player=>({
    ...player,
    ownerName:ownerName(player,teams),
    currentStatus:currentRosterStatus(player),
    source:player.roster_status?"Cloud":"Blank cloud value",
    validation:editableStatus(currentRosterStatus(player))||currentRosterStatus(player)==="FREE_AGENT"?"Valid":"Invalid"
  }));
}
export function pendingStatusFor(row,pendingChanges={}){
  return pendingChanges[row.id]?.newStatus||row.currentStatus;
}
export function setPendingStatus(pendingChanges,row,newStatus){
  const status=editableStatus(newStatus);
  if(!status)return pendingChanges;
  const next={...pendingChanges};
  if(status===row.currentStatus)delete next[row.id];
  else next[row.id]={playerId:row.id,playerName:row.name||"",ownerTeamId:row.owner_team_id||"",currentStatus:row.currentStatus,newStatus:status};
  return next;
}
export function bulkSetPendingStatus(pendingChanges,rows,selectedIds,newStatus){
  const selected=new Set(selectedIds);
  return rows.filter(row=>selected.has(row.id)).reduce((next,row)=>setPendingStatus(next,row,newStatus),pendingChanges);
}
export function clearPendingStatusChanges(pendingChanges,selectedIds=[]){
  if(!selectedIds.length)return {};
  const selected=new Set(selectedIds);
  const next={...pendingChanges};
  selected.forEach(id=>delete next[id]);
  return next;
}
export function clearAllPendingStatusChanges(){return {}}
export function toggleSelection(selectedIds,id,{checked=true,visibleRows=[],lastSelectedId="",shiftKey=false}={}){
  const selected=new Set(selectedIds);
  const ids=visibleRows.map(row=>row.id);
  if(shiftKey&&lastSelectedId&&ids.includes(lastSelectedId)&&ids.includes(id)){
    const start=ids.indexOf(lastSelectedId),end=ids.indexOf(id);
    ids.slice(Math.min(start,end),Math.max(start,end)+1).forEach(rowId=>checked?selected.add(rowId):selected.delete(rowId));
  }else checked?selected.add(id):selected.delete(id);
  return [...selected];
}
export function selectPageRows(selectedIds,rows){
  return [...new Set([...selectedIds,...rows.map(row=>row.id)])];
}
export function selectAllFilteredRows(rows){return rows.map(row=>row.id)}
export function clearSelection(){return []}
export function filterRosterStatusRows(rows=[],filters={},pendingChanges={}){
  const search=text(filters.search);
  return rows.filter(row=>{
    const nextStatus=pendingStatusFor(row,pendingChanges);
    if(search&&!text([row.name,row.ownerName,row.mlb_team,positionTokens(row).join(" ")].join(" ")).includes(search))return false;
    if(filters.currentStatus&&row.currentStatus!==filters.currentStatus)return false;
    if(filters.teamId&&row.owner_team_id!==filters.teamId)return false;
    if(filters.ownerId&&row.owner_team_id!==filters.ownerId)return false;
    if(filters.position&&!positionTokens(row).map(text).includes(text(filters.position)))return false;
    if(filters.mlbTeam&&text(row.mlb_team)!==text(filters.mlbTeam))return false;
    if(filters.freeAgent==="yes"&&!row.is_free_agent)return false;
    if(filters.freeAgent==="no"&&row.is_free_agent)return false;
    if(filters.changedOnly&&!pendingChanges[row.id])return false;
    return editableStatus(nextStatus)||nextStatus==="FREE_AGENT";
  });
}
export function statusSummary(rows=[],pendingChanges={}){
  return EDITABLE_ROSTER_STATUSES.map(status=>({
    status,
    count:rows.filter(row=>pendingStatusFor(row,pendingChanges)===status).length
  }));
}
export function reviewGroups(pendingChanges={}){
  return EDITABLE_ROSTER_STATUSES.map(status=>({
    status,
    rows:Object.values(pendingChanges).filter(change=>change.newStatus===status)
  })).filter(group=>group.rows.length);
}
export function savePayload(pendingChanges={}){
  return Object.values(pendingChanges).filter(change=>editableStatus(change.newStatus)).map(change=>({
    id:change.playerId,
    roster_status:change.newStatus
  }));
}
export function validateRosterStatusSave(rows=[],pendingChanges={}){
  const byId=new Map(rows.map(row=>[row.id,row]));
  const invalid=[];
  Object.values(pendingChanges).forEach(change=>{
    const row=byId.get(change.playerId);
    if(!row)invalid.push({...change,reason:"Player is not in the loaded league rows."});
    else if(!editableStatus(change.newStatus))invalid.push({...change,reason:"New status is not allowed."});
    else if(row.currentStatus==="FREE_AGENT")invalid.push({...change,reason:"Free agents cannot receive owned roster slots."});
  });
  return {valid:invalid.length===0,invalid};
}
