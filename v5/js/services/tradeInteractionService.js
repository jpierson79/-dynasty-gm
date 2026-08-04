export function addTradeAssetSelection(trade,side,player){
  const outgoing=side==="outgoing";
  const ids=outgoing?trade.outgoingPlayerIds||[]:trade.incomingPlayerIds||[];
  const otherIds=outgoing?trade.incomingPlayerIds||[]:trade.outgoingPlayerIds||[];
  if(!player?.id)return {error:"That player is not eligible for this side of the trade."};
  if(ids.includes(player.id)||otherIds.includes(player.id))return {error:"That player is already selected in this trade."};
  const expectedOwnerId=outgoing?trade.userTeamId:trade.partnerTeamId;
  if(player.owner_team_id!==expectedOwnerId||(outgoing&&player.is_free_agent))return {error:"That player is not eligible for this side of the trade."};
  const nextIds=[...ids,player.id].slice(0,8);
  const selected=outgoing?trade.outgoingPlayers||[]:trade.incomingPlayers||[];
  const nextPlayers=nextIds.map(id=>id===player.id?player:selected.find(item=>item.id===id)).filter(Boolean);
  return outgoing
    ?{outgoingPlayerIds:nextIds,outgoingPlayers:nextPlayers,analysis:null,consolidationTargets:null,tradeFits:null,error:""}
    :{incomingPlayerIds:nextIds,incomingPlayers:nextPlayers,analysis:null,error:""};
}

export function removeTradeAssetSelection(trade,side,playerId){
  return side==="outgoing"
    ?{outgoingPlayerIds:(trade.outgoingPlayerIds||[]).filter(id=>id!==playerId),outgoingPlayers:(trade.outgoingPlayers||[]).filter(player=>player.id!==playerId),analysis:null,consolidationTargets:null,tradeFits:null,error:""}
    :{incomingPlayerIds:(trade.incomingPlayerIds||[]).filter(id=>id!==playerId),incomingPlayers:(trade.incomingPlayers||[]).filter(player=>player.id!==playerId),analysis:null,error:""};
}
