(function(){
  function normalizeName(name){
    return String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[.''`]/g,"").replace(/-/g," ").replace(/[^a-z0-9, ]/gi," ").replace(/\s+/g," ").trim().toLowerCase();
  }
  function stableId(prefix,value){
    const raw=normalizeName(value)||"unknown";
    return `${prefix}_${raw.replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}`;
  }
  function playerId(player){
    const explicit=player?.id||player?.player_id||player?.statcastId||player?.mlbamId||player?.mlbam;
    if(explicit)return String(explicit).trim();
    const name=normalizeName(player?.name);
    return name?stableId("player",name):"";
  }
  function managerId(manager){
    return String(manager?.id||stableId("manager",manager?.teamName||manager?.owner||manager?.team||"")).trim();
  }
  function teamId(name){
    return stableId("team",name||"FREE AGENT");
  }
  function normalizePlayerForV4(player){
    const pos=String(player?.pos||"").split(/[\/,\s]+/).filter(Boolean);
    const now=new Date().toISOString();
    return {
      id:playerId(player),
      mlbamId:player?.mlbamId||player?.mlbam||player?.statcastId||player?.player_id||"",
      name:player?.name||"",
      normalizedName:normalizeName(player?.name),
      age:player?.age===""?null:Number(player?.age)||null,
      positions:pos,
      mlbTeam:player?.org||player?.team||"",
      ownerTeamId:teamId(player?.owner||player?.status||"FREE AGENT"),
      rosterStatus:player?.rosterStatus||player?.status||player?.owner||"FREE AGENT",
      hkbValue:Number(player?.hkbValue)||0,
      overallRank:Number(player?.overallRank)||0,
      positionRank:Number(player?.positionRank)||0,
      createdAt:player?.createdAt||player?.updated||now,
      updatedAt:player?.updatedAt||player?.updated||now
    };
  }
  function normalizeManagerForV4(manager){
    return {
      id:managerId(manager),
      teamName:manager?.teamName||"",
      managerName:manager?.managerName||"",
      competitiveWindow:manager?.competitiveWindow||"",
      tradeStyle:manager?.tradeStyle||"",
      hkbReliance:manager?.hkbReliance||"",
      communicationStyle:manager?.communicationStyle||"",
      notes:[manager?.negotiationNotes,manager?.tradeHistoryNotes].filter(Boolean).join("\n"),
      updatedAt:manager?.lastUpdated||manager?.updatedAt||new Date().toISOString()
    };
  }
  function buildTeams(managers,players){
    const map=new Map();
    (managers||[]).forEach(manager=>{
      const m=normalizeManagerForV4(manager);
      if(m.teamName)map.set(teamId(m.teamName),{id:teamId(m.teamName),name:m.teamName,managerId:m.id,competitiveWindow:m.competitiveWindow,updatedAt:m.updatedAt});
    });
    (players||[]).forEach(player=>{
      const name=player?.owner||player?.status||"FREE AGENT";
      const id=teamId(name);
      if(!map.has(id))map.set(id,{id,name,managerId:"",competitiveWindow:"",updatedAt:new Date().toISOString()});
    });
    return [...map.values()];
  }
  window.DynastyMigrationService={normalizeName,stableId,playerId,managerId,teamId,normalizePlayerForV4,normalizeManagerForV4,buildTeams};
})();
