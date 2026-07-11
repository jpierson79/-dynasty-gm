(function(){
  const local=window.DynastyLocalStore;
  const migration=window.DynastyMigrationService;
  function fallbackArray(value){return Array.isArray(value)?value:[]}
  function status(){
    const players=fallbackArray(local.getPlayers());
    const managers=fallbackArray(local.getManagers());
    const trades=fallbackArray(local.getTrades());
    const snapshots=fallbackArray(local.getSnapshots());
    return {
      provider:local.provider,
      layerStatus:"Local adapter active",
      phase:window.DynastyV4Schema?.phase||"Phase 1",
      players:players.length,
      managers:managers.length,
      trades:trades.length,
      snapshots:snapshots.length,
      estimatedBytes:local.estimateBytes(),
      keys:local.allDynastyKeys()
    };
  }
  function integrity(input={}){
    const players=fallbackArray(input.players||local.getPlayers());
    const managers=fallbackArray(input.managers||local.getManagers());
    const trades=fallbackArray(input.trades||local.getTrades());
    const teams=fallbackArray(input.teams||migration.buildTeams(managers,players));
    const metrics=fallbackArray(input.metrics);
    const issues=[];
    const playerIds=new Map();
    const names=new Map();
    players.forEach((player,index)=>{
      const id=migration.playerId(player);
      const name=migration.normalizeName(player?.name);
      if(!id)issues.push({level:"error",check:"Missing required IDs",message:`Player row ${index+1} has no id or name-derived id.`});
      if(id&&playerIds.has(id))issues.push({level:"error",check:"Duplicate player IDs",message:`${id} appears more than once.`});
      if(id)playerIds.set(id,player);
      if(!name)issues.push({level:"error",check:"Missing required IDs",message:`Player row ${index+1} is missing name/normalizedName.`});
      if(name&&names.has(name))issues.push({level:"warn",check:"Duplicate normalized player names",message:`${player.name} duplicates ${names.get(name).name}.`});
      if(name)names.set(name,player);
      ["age","hkbValue","overallRank","positionRank","dynastyAssetScore","championshipImpactScore","tradeLiquidityScore","marketAppreciationScore","dynastyRiskScore","breakoutScore"].forEach(field=>{
        if(player[field]!==undefined&&player[field]!==""&&Number.isNaN(Number(String(player[field]).replace(/[^0-9.\-]/g,"")))){
          issues.push({level:"warn",check:"Invalid numeric values",message:`${player.name||id} has invalid ${field}.`});
        }
      });
    });
    metrics.forEach(metric=>{
      if(metric.playerId&&!playerIds.has(metric.playerId))issues.push({level:"error",check:"Orphaned player metrics",message:`Metric references missing player ${metric.playerId}.`});
    });
    trades.forEach(trade=>{
      (trade.players||[]).forEach(name=>{
        if(!names.has(migration.normalizeName(name)))issues.push({level:"warn",check:"Trades referencing missing players",message:`Trade ${trade.id||trade.date||""} references missing player ${name}.`});
      });
    });
    const managerIds=new Set(managers.map(m=>migration.managerId(m)));
    teams.forEach(team=>{
      if(team.managerId&&!managerIds.has(team.managerId))issues.push({level:"warn",check:"Teams referencing missing managers",message:`Team ${team.name||team.id} references ${team.managerId}.`});
    });
    return {
      passed:issues.filter(i=>i.level==="error").length===0,
      issues,
      summary:{
        duplicatePlayerIds:issues.filter(i=>i.check==="Duplicate player IDs").length,
        duplicateNames:issues.filter(i=>i.check==="Duplicate normalized player names").length,
        orphanedMetrics:issues.filter(i=>i.check==="Orphaned player metrics").length,
        missingTradePlayers:issues.filter(i=>i.check==="Trades referencing missing players").length,
        missingManagers:issues.filter(i=>i.check==="Teams referencing missing managers").length,
        invalidNumbers:issues.filter(i=>i.check==="Invalid numeric values").length,
        missingIds:issues.filter(i=>i.check==="Missing required IDs").length
      }
    };
  }
  window.DynastyDataStore={
    provider:local.provider,
    storageKeys:()=>({...local.keys}),
    legacyKeys:()=>[...local.legacyKeys],
    getPlayers:()=>fallbackArray(local.getPlayers()),
    savePlayers:players=>local.savePlayers(players),
    getManagers:()=>fallbackArray(local.getManagers()),
    saveManagers:managers=>local.saveManagers(managers),
    getTrades:()=>fallbackArray(local.getTrades()),
    saveTrades:trades=>local.saveTrades(trades),
    getSnapshots:()=>fallbackArray(local.getSnapshots()),
    saveSnapshots:snapshots=>local.saveSnapshots(snapshots),
    getSettings:()=>local.getSettings()||{},
    saveSettings:settings=>local.saveSettings(settings),
    getWorkflow:()=>local.getWorkflow()||{},
    saveWorkflow:workflow=>local.saveWorkflow(workflow),
    estimateStorageBytes:()=>local.estimateBytes(),
    status,
    integrity,
    normalizePlayerForV4:migration.normalizePlayerForV4,
    normalizeManagerForV4:migration.normalizeManagerForV4,
    buildTeams:migration.buildTeams
  };
})();
