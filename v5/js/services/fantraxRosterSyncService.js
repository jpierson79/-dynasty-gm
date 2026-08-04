const clean=value=>String(value??"").trim();

export function fantraxRosterSyncPeriodGuard(period=""){
  const selectedPeriod=clean(period);
  return selectedPeriod?{valid:false,error:`Roster-status synchronization is blocked for historical scoring period ${selectedPeriod}. Refresh the Current preview before reviewing updates.`}:{valid:true,error:""};
}

export function reviewedFantraxStatusUpdates(rosterItems=[]){
  return rosterItems.filter(row=>row.futureSyncRecommendation==="APPLY_FANTRAX_STATUS").map(row=>({
    id:clean(row.matchedPlayerUuid),
    name:clean(row.matchedPlayer?.name)||clean(row.fantraxApiPlayerId),
    currentRosterStatus:clean(row.currentRosterStatus).toUpperCase(),
    roster_status:clean(row.normalizedRosterStatus).toUpperCase(),
    expectedOwnerTeamId:clean(row.currentOwnerTeamId),
    fantraxApiPlayerId:clean(row.fantraxApiPlayerId),
    fantraxTeamId:clean(row.fantraxTeamId)
  }));
}

export function validateReviewedFantraxStatusUpdates(rosterItems=[]){
  const updates=reviewedFantraxStatusUpdates(rosterItems),errors=[],ids=new Set();
  updates.forEach(update=>{
    if(!update.id)errors.push(`Missing cloud player UUID for ${update.name||"Fantrax roster row"}.`);
    if(ids.has(update.id))errors.push(`Cloud player ${update.id} appears more than once in the reviewed update set.`);
    ids.add(update.id);
    if(!["ACTIVE","RESERVE","IL","MINORS"].includes(update.roster_status))errors.push(`Unsupported Fantrax roster status for ${update.name||update.id}.`);
    if(!update.currentRosterStatus)errors.push(`Missing current cloud roster status for ${update.name||update.id}.`);
    if(!update.expectedOwnerTeamId)errors.push(`Missing expected cloud owner for ${update.name||update.id}.`);
  });
  const recommended=new Set(updates.map(update=>update.id));
  rosterItems.filter(row=>recommended.has(clean(row.matchedPlayerUuid))).forEach(row=>{
    if(row.playerIdentityResult!=="MATCHED")errors.push(`Player identity is not exact for ${row.fantraxApiPlayerId||"a roster row"}.`);
    if(row.teamIdentityResult!=="MATCHED")errors.push(`Team identity is not persisted for ${row.fantraxTeamName||"a roster row"}.`);
    if(clean(row.currentOwnerTeamId)!==clean(row.matchedTeamUuid))errors.push(`Expected cloud owner does not match the persisted Fantrax team for ${row.matchedPlayer?.name||row.fantraxApiPlayerId}.`);
    if(row.ownershipDifference)errors.push(`Cloud ownership differs from Fantrax for ${row.matchedPlayer?.name||row.fantraxApiPlayerId}.`);
    if(row.activeManualOverride)errors.push(`Manual override is active for ${row.matchedPlayer?.name||row.fantraxApiPlayerId}.`);
  });
  return {valid:updates.length>0&&errors.length===0,updates,errors};
}

export function controlledFantraxRosterSelection(selectedIds=[],playerId="",checked=false,limit=3){
  const ids=[...new Set((selectedIds||[]).map(clean).filter(Boolean))],id=clean(playerId);
  if(!id)return {selectedIds:ids,error:"A cloud player UUID is required."};
  const next=checked?[...new Set([...ids,id])]:ids.filter(value=>value!==id);
  if(next.length>limit)return {selectedIds:ids,error:`Controlled acceptance is limited to ${limit} players.`};
  return {selectedIds:next,error:""};
}

export function validateControlledFantraxStatusUpdates(rosterItems=[],selectedIds=[],limit=3){
  const ids=(selectedIds||[]).map(clean).filter(Boolean),errors=[];
  if(new Set(ids).size!==ids.length)errors.push("The controlled update set contains a duplicate cloud player UUID.");
  if(!ids.length)errors.push("Select at least one eligible status update.");
  if(ids.length>limit)errors.push(`Controlled acceptance is limited to ${limit} players.`);
  const selected=new Set(ids),selectedRows=rosterItems.filter(row=>selected.has(clean(row.matchedPlayerUuid)));
  ids.filter(id=>!selectedRows.some(row=>clean(row.matchedPlayerUuid)===id)).forEach(id=>errors.push(`Selected cloud player ${id} is not present in the preview.`));
  const validation=validateReviewedFantraxStatusUpdates(selectedRows);
  if(ids.length&&!validation.valid)errors.push(...validation.errors);
  if(validation.updates.length!==ids.length)errors.push("Every selected player must remain eligible for a Fantrax status update.");
  return {valid:errors.length===0,updates:validation.updates,errors:[...new Set(errors)]};
}

export function fantraxRosterSyncSkipReason(update,currentRow,{writeFailed=false}={}){
  if(!currentRow)return "NOT_FOUND_OR_DENIED";
  if(clean(currentRow.roster_status_source).toUpperCase()==="MANUAL")return "MANUAL_OVERRIDE";
  if(clean(currentRow.owner_team_id)!==clean(update.expectedOwnerTeamId))return "OWNER_CHANGED";
  if(clean(currentRow.roster_status).toUpperCase()!==clean(update.currentRosterStatus).toUpperCase())return "STATUS_CHANGED";
  return writeFailed?"WRITE_FAILED_OR_NOT_ATTEMPTED":"NO_ROW_UPDATED";
}

export function fantraxRosterSyncSummary(result={}){
  const reasons={};
  (result.skipped||[]).forEach(row=>{const reason=row.reason||"UNKNOWN";reasons[reason]=(reasons[reason]||0)+1});
  return {reviewed:Number(result.reviewed||0),updated:(result.updated||[]).length,skipped:(result.skipped||[]).length,failedGroups:(result.failures||[]).length,skipReasons:reasons};
}
