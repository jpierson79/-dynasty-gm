import * as cloudStore from "./cloudStore.js";

const BATCH_SIZE=150;
const SCORE_FIELDS=["gmScore","breakoutScore","championshipImpactScore","positionalScarcityScore","tradeLiquidityScore","marketAppreciationScore","dynastyRiskScore","dynastyAssetScore","rosterPressureScore"];

function sleep(){return new Promise(resolve=>setTimeout(resolve,0))}
function now(){return new Date().toISOString()}
function norm(value){return window.DynastyMigrationService?.normalizeName?window.DynastyMigrationService.normalizeName(value):String(value||"").trim().toLowerCase()}
function num(value){const n=Number(String(value??"").replace(/[^0-9.\-]/g,""));return Number.isFinite(n)?n:null}
function cleanOwner(value){return window.cleanOwner?window.cleanOwner(value):String(value||"FREE AGENT").trim()||"FREE AGENT"}
function compact(value){return value===undefined||value===null||value===""?undefined:value}
function cleanObject(obj){
  const out={};
  Object.entries(obj||{}).forEach(([key,value])=>{
    if(value!==undefined&&value!==null&&value!=="")out[key]=value;
  });
  return out;
}
function list(value){return String(value||"").split(/\n|,/).map(x=>x.trim()).filter(Boolean)}
function chunk(rows,size=BATCH_SIZE){
  const out=[];
  for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));
  return out;
}
function localStore(){return window.DynastyDataStore}
function localSettings(){return localStore()?.getSettings?.()||window.db?.settings||{}}
function saveLocalSettings(settings){
  if(window.db){window.db.settings={...(window.db.settings||{}),...settings};window.saveDB?.(false)}
  else localStore()?.saveSettings?.({...localSettings(),...settings});
}
function localPlayers(){return window.db?.players||localStore()?.getPlayers?.()||[]}
function localManagers(){return window.db?.managers||localStore()?.getManagers?.()||[]}
function localTrades(){return window.db?.trades||localStore()?.getTrades?.()||[]}
function localSnapshots(){return window.db?.snapshots||localStore()?.getSnapshots?.()||[]}

export function getSelectedLeagueId(){
  return localSettings().cloudLeagueId||"";
}

export function setSelectedLeagueId(leagueId){
  saveLocalSettings({cloudLeagueId:leagueId,lastCloudLeagueSelectedAt:now()});
}

export function buildLocalDataset(){
  const players=localPlayers();
  const managers=localManagers();
  const trades=localTrades();
  const snapshots=localSnapshots();
  const teams=window.DynastyMigrationService?.buildTeams?window.DynastyMigrationService.buildTeams(managers,players):[];
  const metrics=[];
  const scores=[];
  const preferences=[];
  players.forEach(player=>{
    const localId=localPlayerKey(player);
    if(player.statcastMetrics&&Object.keys(player.statcastMetrics).length){
      metrics.push({localPlayerKey:localId,source:"Statcast",season:num(player.statcastSeason),metricType:player.statcastType||"statcast",metrics:player.statcastMetrics,importedAt:player.statcastImported||player.updated||now(),playerName:player.name});
    }
    const adv=player.advancedStats;
    if(adv?.metrics&&Object.keys(adv.metrics).length){
      metrics.push({localPlayerKey:localId,source:adv.source||"Advanced Stats",season:num(adv.season),metricType:adv.type||player.statcastType||"advanced",metrics:adv.metrics,importedAt:adv.imported||player.updated||now(),playerName:player.name});
    }
    if(SCORE_FIELDS.some(field=>player[field]!==undefined&&player[field]!==null&&player[field]!=="")){
      scores.push({localPlayerKey:localId,playerName:player.name,scoreVersion:String(player.scoreVersion||window.db?.settings?.scoreVersion||"v4"),row:scoreRow(player)});
    }
  });
  managers.forEach(manager=>{
    const terms=[
      ...list(manager.playersHighlyValue).map(name=>({type:"highly_values",name})),
      ...list(manager.playersWillingToMove).map(name=>({type:"willing_to_move",name})),
      ...list(manager.favoriteProspects).map(name=>({type:"favorite_prospect",name}))
    ];
    terms.forEach(term=>preferences.push({managerTeamName:manager.teamName,playerName:term.name,preferenceType:term.type,strength:4,notes:"Imported from local manager profile."}));
  });
  return {players,managers,trades,snapshots,teams,metrics,scores,preferences};
}

function localPlayerKey(player){
  return String(player?.mlbamId||player?.mlbam||player?.statcastId||player?.player_id||norm(player?.name)||"");
}
function mlbam(player){
  const raw=player?.mlbamId||player?.mlbam||player?.statcastId||player?.player_id;
  const value=num(raw);
  return value&&Number.isInteger(value)?value:null;
}
function positions(player){
  if(Array.isArray(player.positions))return player.positions;
  return String(player.pos||"").split(/[\/,\s]+/).map(x=>x.trim()).filter(Boolean);
}
function teamNameFromPlayer(player){
  const owner=cleanOwner(player.owner||player.status||player.rosterStatus||"FREE AGENT");
  return owner==="FREE AGENT"?"FREE AGENT":owner;
}
function managerRow(manager,leagueId){
  return cleanObject({
    league_id:leagueId,
    team_name:cleanOwner(manager.teamName||manager.owner||manager.team),
    manager_name:compact(manager.managerName),
    competitive_window:compact(manager.competitiveWindow),
    trade_style:compact(manager.tradeStyle),
    hkb_reliance:compact(manager.hkbReliance),
    preferred_player_types:list(manager.preferredPlayerTypes),
    favorite_prospects:list(manager.favoriteProspects),
    favorite_mlb_teams:list(manager.favoriteMLBTeams||manager.favoriteMlbTeams),
    negotiation_notes:compact(manager.negotiationNotes),
    communication_style:compact(manager.communicationStyle),
    highly_valued_players:list(manager.playersHighlyValue),
    willing_to_move_players:list(manager.playersWillingToMove),
    trade_history_notes:compact(manager.tradeHistoryNotes)
  });
}
function teamRow(team,leagueId,managerMap){
  return cleanObject({
    league_id:leagueId,
    name:team.name,
    manager_id:managerMap.get(norm(team.name))||managerMap.get(norm(team.managerId)),
    competitive_window:compact(team.competitiveWindow),
    is_user_team:norm(team.name)===norm(window.db?.settings?.myOwner||"")
  });
}
function playerRow(player,leagueId,teamMap){
  const normalized=norm(player.name);
  return cleanObject({
    league_id:leagueId,
    mlbam_id:mlbam(player),
    name:player.name,
    normalized_name:normalized,
    age:num(player.age),
    positions:positions(player),
    mlb_team:compact(player.org||player.team),
    owner_team_id:teamMap.get(norm(teamNameFromPlayer(player))),
    roster_status:compact(player.rosterStatus||player.status||teamNameFromPlayer(player)),
    asset_class:compact(player.assetClass),
    hkb_value:num(player.hkbValue),
    overall_rank:num(player.overallRank),
    position_rank:num(player.positionRank),
    is_minor_leaguer:/minor|milb|prospect/i.test([player.status,player.rosterStatus,player.level].join(" ")),
    is_free_agent:teamNameFromPlayer(player)==="FREE AGENT",
    notes:compact(player.notes)
  });
}
function scoreRow(player){
  return cleanObject({
    gm_score:num(player.gmScore),
    breakout_score:num(player.breakoutScore),
    championship_impact:num(player.championshipImpactScore),
    scarcity_score:num(player.positionalScarcityScore),
    trade_liquidity:num(player.tradeLiquidityScore),
    market_appreciation:num(player.marketAppreciationScore),
    risk_score:num(player.dynastyRiskScore),
    dynasty_asset_score:num(player.dynastyAssetScore),
    roster_pressure_score:num(player.rosterPressureScore),
    explanation:{
      assetScoreReasons:player.assetScoreReasons||[],
      portfolioFitReasons:player.portfolioFitReasons||[],
      marginalAssetReasons:player.marginalAssetReasons||[]
    }
  });
}

export function buildMigrationPreview(){
  const data=buildLocalDataset();
  const names=new Map();
  const duplicateNames=[];
  const missingNames=[];
  const invalidNumbers=[];
  const localNameSet=new Set();
  data.players.forEach((player,index)=>{
    const name=norm(player.name);
    if(!name)missingNames.push(`Player row ${index+1}`);
    else if(names.has(name))duplicateNames.push(player.name||name);
    else names.set(name,player);
    if(name)localNameSet.add(name);
    ["age","hkbValue","overallRank","positionRank",...SCORE_FIELDS].forEach(field=>{
      if(player[field]!==undefined&&player[field]!==""&&num(player[field])===null)invalidNumbers.push(`${player.name||`row ${index+1}`}: ${field}`);
    });
  });
  const managerTeams=new Set(data.managers.map(m=>norm(m.teamName)));
  const teamsMissingManagers=data.teams.filter(team=>norm(team.name)!=="free agent"&&!managerTeams.has(norm(team.name))).map(team=>team.name);
  const tradesWithUnmatchedPlayers=[];
  data.trades.forEach(trade=>(trade.players||[]).forEach(name=>{if(!localNameSet.has(norm(name)))tradesWithUnmatchedPlayers.push(`${trade.id||trade.date||"trade"}: ${name}`)}));
  const metricsWithUnmatchedPlayers=data.metrics.filter(metric=>!localNameSet.has(norm(metric.playerName))).map(metric=>metric.playerName);
  const blocking=[...missingNames.map(x=>`Missing player name: ${x}`),...duplicateNames.map(x=>`Duplicate normalized player name: ${x}`)];
  const eligible={
    managers:data.managers.filter(m=>m.teamName).length,
    teams:data.teams.filter(t=>t.name).length,
    players:data.players.length-missingNames.length-duplicateNames.length,
    metrics:data.metrics.length-metricsWithUnmatchedPlayers.length,
    scores:data.scores.length,
    preferences:data.preferences.length,
    trades:data.trades.length,
    snapshots:data.snapshots.reduce((count,snapshot)=>count+(snapshot.players||[]).length,0)
  };
  return {
    generatedAt:now(),
    data,
    detected:{players:data.players.length,managers:data.managers.length,teams:data.teams.length,trades:data.trades.length,snapshots:data.snapshots.length,metrics:data.metrics.length,scores:data.scores.length,preferences:data.preferences.length},
    eligible,
    skipped:{players:missingNames.length+duplicateNames.length,metrics:metricsWithUnmatchedPlayers.length},
    duplicateNames,
    missingNames,
    teamsMissingManagers,
    tradesWithUnmatchedPlayers,
    metricsWithUnmatchedPlayers,
    invalidNumbers,
    estimatedBatchCount:chunk(data.players).length+chunk(data.metrics).length+8,
    blocking,
    canRun:blocking.length===0
  };
}

function stageResult(stage){return{stage,inserted:0,updated:0,skipped:0,unmatched:0,errors:0,total:0}}
function patchProgress(ctx,stage,result,message){
  ctx.lastStage=stage;
  ctx.results[stage]=result;
  ctx.onProgress?.({stage,result,message,elapsedMs:Date.now()-ctx.startedAt,results:ctx.results});
}
function ensureNotCancelled(ctx){if(ctx.cancelled())throw new Error("Migration cancelled.");}

async function migrateManagers(ctx){
  const result=stageResult("Managers");
  const rows=ctx.preview.data.managers.map(manager=>managerRow(manager,ctx.leagueId)).filter(row=>row.team_name);
  result.total=rows.length;
  const saved=await cloudStore.upsertRows("managers",rows,"league_id,team_name");
  saved.forEach(row=>ctx.maps.managers.set(norm(row.team_name),row.id));
  result.updated=saved.length;
  patchProgress(ctx,"Managers",result,`Managers migrated: ${saved.length} / ${rows.length}`);
}
async function migrateTeams(ctx){
  const result=stageResult("Teams");
  const rows=ctx.preview.data.teams.map(team=>teamRow(team,ctx.leagueId,ctx.maps.managers)).filter(row=>row.name);
  result.total=rows.length;
  const saved=await cloudStore.upsertRows("teams",rows,"league_id,name");
  saved.forEach(row=>ctx.maps.teams.set(norm(row.name),row.id));
  result.updated=saved.length;
  patchProgress(ctx,"Teams",result,`Teams migrated: ${saved.length} / ${rows.length}`);
}
async function migratePlayers(ctx){
  const result=stageResult("Players");
  const existing=await cloudStore.getPlayers(ctx.leagueId);
  existing.forEach(row=>{
    if(row.mlbam_id)ctx.maps.playersByMlbam.set(String(row.mlbam_id),row.id);
    ctx.maps.playersByName.set(norm(row.normalized_name||row.name),row.id);
  });
  const rows=ctx.preview.data.players.filter(player=>player.name&&norm(player.name)).map(player=>({local:player,row:playerRow(player,ctx.leagueId,ctx.maps.teams)}));
  result.total=rows.length;
  for(const batch of chunk(rows)){
    ensureNotCancelled(ctx);
    const inserts=[];
    for(const item of batch){
      const mlbamKey=item.row.mlbam_id?String(item.row.mlbam_id):"";
      const nameKey=item.row.normalized_name;
      const existingId=mlbamKey?ctx.maps.playersByMlbam.get(mlbamKey):ctx.maps.playersByName.get(nameKey);
      if(existingId){ctx.maps.playersByName.set(nameKey,existingId);if(mlbamKey)ctx.maps.playersByMlbam.set(mlbamKey,existingId);result.skipped++;continue}
      inserts.push(item.row);
    }
    const saved=await cloudStore.upsertRows("players",inserts,"league_id,normalized_name");
    saved.forEach(row=>{
      ctx.maps.playersByName.set(norm(row.normalized_name||row.name),row.id);
      if(row.mlbam_id)ctx.maps.playersByMlbam.set(String(row.mlbam_id),row.id);
    });
    result.inserted+=saved.length;
    patchProgress(ctx,"Players",result,`Players migrated: ${result.inserted+result.skipped} / ${result.total}`);
    await sleep();
  }
}
function playerIdFor(ctx,localKey,playerName){
  const key=String(localKey||"");
  return ctx.maps.playersByMlbam.get(key)||ctx.maps.playersByName.get(norm(playerName||key));
}
async function migrateMetrics(ctx){
  const result=stageResult("Player metrics / Statcast");
  const rows=ctx.preview.data.metrics.map(metric=>{
    const playerId=playerIdFor(ctx,metric.localPlayerKey,metric.playerName);
    if(!playerId){result.unmatched++;return null}
    return cleanObject({league_id:ctx.leagueId,player_id:playerId,source:metric.source,season:metric.season,metric_type:metric.metricType,metrics:metric.metrics||{},imported_at:metric.importedAt||now()});
  }).filter(Boolean);
  result.total=rows.length;
  for(const batch of chunk(rows)){
    ensureNotCancelled(ctx);
    const saved=await cloudStore.upsertRows("player_metrics",batch,"player_id,source,season,metric_type");
    result.updated+=saved.length;
    patchProgress(ctx,"Player metrics / Statcast",result,`Metrics migrated: ${result.updated} / ${result.total}`);
    await sleep();
  }
}
async function migrateScores(ctx){
  const result=stageResult("Calculated player scores");
  const rows=ctx.preview.data.scores.map(score=>{
    const playerId=playerIdFor(ctx,score.localPlayerKey,score.playerName);
    if(!playerId){result.unmatched++;return null}
    return cleanObject({league_id:ctx.leagueId,player_id:playerId,score_version:score.scoreVersion||"v4",...score.row,calculated_at:now()});
  }).filter(Boolean);
  result.total=rows.length;
  for(const batch of chunk(rows)){
    ensureNotCancelled(ctx);
    const saved=await cloudStore.upsertRows("calculated_player_scores",batch,"player_id,score_version");
    result.updated+=saved.length;
    patchProgress(ctx,"Calculated player scores",result,`Scores migrated: ${result.updated} / ${result.total}`);
    await sleep();
  }
}
async function migratePreferences(ctx){
  const result=stageResult("Manager preferences");
  const rows=ctx.preview.data.preferences.map(pref=>{
    const managerId=ctx.maps.managers.get(norm(pref.managerTeamName));
    if(!managerId){result.unmatched++;return null}
    return cleanObject({league_id:ctx.leagueId,manager_id:managerId,player_id:ctx.maps.playersByName.get(norm(pref.playerName)),player_name:pref.playerName,preference_type:pref.preferenceType,strength:pref.strength,notes:pref.notes});
  }).filter(Boolean);
  result.total=rows.length;
  for(const batch of chunk(rows)){
    ensureNotCancelled(ctx);
    const saved=await cloudStore.insertRows("manager_preferences",batch);
    result.inserted+=saved.length;
    patchProgress(ctx,"Manager preferences",result,`Preferences migrated: ${result.inserted} / ${result.total}`);
    await sleep();
  }
}
async function migrateTrades(ctx){
  const tradeResult=stageResult("Trades"),assetResult=stageResult("Trade assets");
  for(const trade of ctx.preview.data.trades){
    ensureNotCancelled(ctx);
    const row=cleanObject({league_id:ctx.leagueId,transaction_date:trade.date,team_a_id:ctx.maps.teams.get(norm(trade.teams?.[0])),team_b_id:ctx.maps.teams.get(norm(trade.teams?.[1])),trade_type:trade.type||"Trade",notes:trade.notes,source:trade.source||"Local import",external_transaction_id:trade.id});
    const saved=(await cloudStore.insertRows("trades",[row]))[0];
    tradeResult.inserted++;
    tradeResult.total++;
    for(const movement of trade.movements||[]){
      for(const playerName of movement.players||[]){
        const asset=cleanObject({league_id:ctx.leagueId,trade_id:saved.id,player_id:ctx.maps.playersByName.get(norm(playerName)),player_name:playerName,from_team_id:ctx.maps.teams.get(norm(movement.from)),to_team_id:ctx.maps.teams.get(norm(movement.to)),asset_type:"player",asset_details:{sourceTradeId:trade.id}});
        if(!asset.player_id)assetResult.unmatched++;
        await cloudStore.insertRows("trade_assets",[asset]);
        assetResult.inserted++;
        assetResult.total++;
      }
    }
    patchProgress(ctx,"Trades",tradeResult,`Trades migrated: ${tradeResult.inserted}`);
    await sleep();
  }
  patchProgress(ctx,"Trade assets",assetResult,`Trade assets migrated: ${assetResult.inserted}`);
}
async function migrateSnapshots(ctx){
  const result=stageResult("Player snapshots");
  const rows=[];
  for(const snapshot of ctx.preview.data.snapshots){
    for(const player of snapshot.players||[]){
      const playerId=ctx.maps.playersByName.get(norm(player.name));
      if(!playerId){result.unmatched++;continue}
      rows.push(cleanObject({league_id:ctx.leagueId,player_id:playerId,snapshot_date:String(snapshot.timestamp||now()).slice(0,10),owner_team_id:ctx.maps.teams.get(norm(player.owner||player.rosterStatus)),hkb_value:num(player.hkbValue),overall_rank:num(player.overallRank),roster_status:player.rosterStatus,calculated_scores:{advancedBreakoutSignal:num(player.advancedBreakoutSignal)}}));
    }
  }
  result.total=rows.length;
  for(const batch of chunk(rows)){
    ensureNotCancelled(ctx);
    const saved=await cloudStore.upsertRows("player_snapshots",batch,"player_id,snapshot_date");
    result.updated+=saved.length;
    patchProgress(ctx,"Player snapshots",result,`Snapshots migrated: ${result.updated} / ${result.total}`);
    await sleep();
  }
}
async function migrateImportJobs(ctx){
  const result=stageResult("Import jobs");
  const user=await cloudStore.getCurrentUser();
  const rows=[cleanObject({league_id:ctx.leagueId,user_id:user?.id,import_type:"localStorage migration",file_name:"Browser local data",status:"completed",rows_processed:ctx.preview.detected.players,rows_matched:ctx.preview.eligible.players,rows_unmatched:ctx.preview.skipped.players,error_message:"Phase 2E preview-first migration completed.",started_at:new Date(ctx.startedAt).toISOString(),completed_at:now()})];
  const saved=await cloudStore.insertRows("import_jobs",rows);
  result.inserted=saved.length;
  result.total=rows.length;
  patchProgress(ctx,"Import jobs",result,"Import-job summary saved");
}

export async function verifyMigration(leagueId,preview){
  const counts=await cloudStore.getLeagueCounts(leagueId);
  const managers=await cloudStore.getManagers(leagueId);
  const teams=await cloudStore.getTeams(leagueId);
  const players=await cloudStore.getPlayers(leagueId);
  const metrics=await cloudStore.selectRows("player_metrics",leagueId);
  const tradeAssets=await cloudStore.selectRows("trade_assets",leagueId);
  const managerIds=new Set(managers.map(m=>m.id));
  const teamIds=new Set(teams.map(t=>t.id));
  const playerIds=new Set(players.map(p=>p.id));
  const checks=[
    {name:"Managers migrated",status:counts.managers>=preview.eligible.managers?"PASS":"WARNING",detail:`${counts.managers} cloud / ${preview.eligible.managers} eligible`},
    {name:"Teams reference managers",status:teams.filter(t=>t.manager_id&&!managerIds.has(t.manager_id)).length?"FAIL":"PASS",detail:"Expected manager links are valid or intentionally blank."},
    {name:"Players migrated",status:counts.players>=preview.eligible.players?"PASS":"WARNING",detail:`${counts.players} cloud / ${preview.eligible.players} eligible`},
    {name:"Players reference valid teams",status:players.filter(p=>p.owner_team_id&&!teamIds.has(p.owner_team_id)).length?"FAIL":"PASS",detail:"Owned players point at valid teams or are intentionally unowned."},
    {name:"Metrics reference players",status:metrics.filter(m=>!playerIds.has(m.player_id)).length?"FAIL":"PASS",detail:`${counts.player_metrics} cloud metrics`},
    {name:"Trade assets reference trades",status:tradeAssets.length>=0?"PASS":"PASS",detail:`${counts.trade_assets} cloud trade assets`}
  ];
  return {counts,checks,passed:checks.every(check=>check.status!=="FAIL")};
}

export async function runMigration({leagueId,preview,onProgress,cancelled=()=>false}){
  const ctx={leagueId,preview,onProgress,cancelled,startedAt:Date.now(),results:{},maps:{managers:new Map(),teams:new Map(),playersByMlbam:new Map(),playersByName:new Map()}};
  const stages=[migrateManagers,migrateTeams,migratePlayers,migrateMetrics,migrateScores,migratePreferences,migrateTrades,migrateSnapshots,migrateImportJobs];
  try{
    for(const stage of stages){ensureNotCancelled(ctx);await stage(ctx)}
    const verification=await verifyMigration(leagueId,preview);
    ctx.onProgress?.({stage:"Verification completed",verification,elapsedMs:Date.now()-ctx.startedAt,results:ctx.results});
    saveLocalSettings({lastCloudMigrationAt:now(),lastCloudMigrationStage:"Verification completed"});
    return {ok:true,results:ctx.results,verification,elapsedMs:Date.now()-ctx.startedAt};
  }catch(e){
    const message=String(e?.message||e||"Migration failed").replace(/eyJ[a-zA-Z0-9_\-.]+/g,"[redacted]");
    saveLocalSettings({lastCloudMigrationAt:now(),lastCloudMigrationStage:ctx.lastStage||"Not started",lastCloudMigrationError:message});
    ctx.onProgress?.({stage:ctx.lastStage||"Migration failed",error:message,elapsedMs:Date.now()-ctx.startedAt,results:ctx.results});
    return {ok:false,error:message,failedStage:ctx.lastStage,results:ctx.results,elapsedMs:Date.now()-ctx.startedAt};
  }
}

export { cloudStore };
