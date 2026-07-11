(function(){
  const keys={
    players:"dynasty_players",
    managers:"dynasty_managers",
    trades:"dynasty_trades",
    statcast:"dynasty_statcast",
    snapshots:"dynasty_snapshots",
    settings:"dynasty_settings",
    workflow:"dynasty_workflow"
  };
  const legacyKeys=[
    "dynasty_gm_front_office_v3",
    "dynasty_gm_front_office_v2",
    "dynasty_gm_front_office_v1",
    "dynasty_gm_score_cache_v1",
    "dynasty_gm_analysis_cache_v1",
    "dynasty_gm_master_players_v1"
  ];
  function readJSON(key, fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw?JSON.parse(raw):fallback;
    }catch(e){
      console.warn("[V4 localStore] read failed",key,e);
      return fallback;
    }
  }
  function writeJSON(key, value){
    try{
      localStorage.setItem(key,JSON.stringify(value));
      return true;
    }catch(e){
      console.error("[V4 localStore] write failed",key,e);
      throw e;
    }
  }
  function remove(key){
    try{localStorage.removeItem(key)}catch(e){console.warn("[V4 localStore] remove failed",key,e)}
  }
  function estimateBytes(){
    let chars=0;
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||"";
        chars+=key.length+(localStorage.getItem(key)||"").length;
      }
    }catch(e){
      console.warn("[V4 localStore] storage estimate failed",e);
    }
    return chars*2;
  }
  function allDynastyKeys(){
    const out=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||"";
        if(key.startsWith("dynasty_"))out.push(key);
      }
    }catch(e){
      console.warn("[V4 localStore] key scan failed",e);
    }
    return out.sort();
  }
  window.DynastyLocalStore={
    provider:"Browser Local Storage",
    keys,
    legacyKeys,
    readJSON,
    writeJSON,
    remove,
    estimateBytes,
    allDynastyKeys,
    getPlayers:()=>readJSON(keys.players,[]),
    savePlayers:players=>writeJSON(keys.players,players||[]),
    getManagers:()=>readJSON(keys.managers,[]),
    saveManagers:managers=>writeJSON(keys.managers,managers||[]),
    getTrades:()=>readJSON(keys.trades,[]),
    saveTrades:trades=>writeJSON(keys.trades,trades||[]),
    getSnapshots:()=>readJSON(keys.snapshots,[]),
    saveSnapshots:snapshots=>writeJSON(keys.snapshots,snapshots||[]),
    getSettings:()=>readJSON(keys.settings,{myOwner:"Josh"}),
    saveSettings:settings=>writeJSON(keys.settings,settings||{}),
    getWorkflow:()=>readJSON(keys.workflow,{}),
    saveWorkflow:workflow=>writeJSON(keys.workflow,workflow||{})
  };
})();
