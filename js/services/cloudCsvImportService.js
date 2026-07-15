import * as cloudStore from "./cloudStore.js";
import { PlayerIdentityResolver } from "./PlayerIdentityResolver.js";
import { InMemoryPlayerIdentityRepository } from "./identity/InMemoryPlayerIdentityRepository.js";
import { buildPlayerIdentityIndexes, resolvePlayerIdentity } from "./playerIdentity.js";

const BATCH_SIZE=150;
const CHECKPOINT_KEY="dynasty_cloud_import_checkpoint_v1";
const STEP_ORDER=["fantrax","hkb","statcastHitters","statcastPitchers","trades","custom","verification","enable"];
const STEP_LABELS={
  fantrax:"Fantrax player pool and roster",
  hkb:"HarryKnowsBall values",
  statcastHitters:"Statcast hitters",
  statcastPitchers:"Statcast pitchers",
  trades:"Fantrax trade history",
  custom:"Custom Intelligence JSON",
  verification:"Verification",
  enable:"Enable Cloud Data"
};

function sleep(){return new Promise(resolve=>setTimeout(resolve,0))}
function now(){return new Date().toISOString()}
function norm(value){return window.DynastyMigrationService?.normalizeName?window.DynastyMigrationService.normalizeName(value):String(value||"").trim().toLowerCase()}
function clean(value){return String(value??"").trim()}
function num(value){const n=Number(String(value??"").replace(/[^0-9.\-]/g,""));return Number.isFinite(n)?n:null}
function chunk(rows,size=BATCH_SIZE){const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out}
function cleanOwner(value){
  const s=clean(value);
  if(!s)return"FREE AGENT";
  const low=s.toLowerCase();
  return ["fa","free agent","waivers","available","-","--","none","n/a"].includes(low)?"FREE AGENT":s;
}
function isFantasyTeamName(value){return cleanOwner(value)!=="FREE AGENT"}
function cleanObject(obj){
  const out={};
  Object.entries(obj||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")out[k]=v});
  return out;
}
function keyify(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"").trim()}
function headerMap(head){
  const normalized=head.map(h=>keyify(h));
  return {
    head,
    find(names){
      const list=Array.isArray(names)?names:[names];
      for(const name of list){
        const ix=normalized.indexOf(keyify(name));
        if(ix>=0)return ix;
      }
      return -1;
    }
  };
}
function exactHeaderIndex(head,names){
  const list=Array.isArray(names)?names:[names];
  return head.findIndex(header=>list.some(name=>String(header||"").trim().toLowerCase()===String(name||"").trim().toLowerCase()));
}
function cell(row,ix){return ix>=0?clean(row[ix]):""}
function textCell(row,ix){return ix>=0?String(row[ix]??"").trim():""}
function splitPositions(value){return clean(value).split(/[\/,\s]+/).map(x=>x.trim()).filter(Boolean)}
function fantraxPlayerIndexes(head){
  const map=headerMap(head);
  return {
    map,
    name:map.find(["player","player name","name"]),
    owner:map.find(["status","owner","fantasy team","team owner","roster status"]),
    pos:map.find(["position","positions","pos"]),
    org:map.find(["team","mlb team","org","organization"]),
    age:map.find(["age"]),
    fantrax:exactHeaderIndex(head,["ID","Fantrax ID","Fantrax Player ID"]),
    mlbam:exactHeaderIndex(head,["MLBAM ID","MLB ID","MLB Player ID"]),
    status:map.find(["status","roster status"]),
    minor:map.find(["minor","minors","minor league","level"])
  };
}
function saveCheckpoint(patch){
  try{
    const current=JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||"{}");
    localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({...current,...patch,updatedAt:now()}));
  }catch(e){console.warn("[Cloud Import] checkpoint skipped",e?.message||"unknown")}
}
export function getCheckpoint(){
  try{return JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||"{}")}catch(e){return{}}
}
export function saveImportCheckpoint(patch){saveCheckpoint(patch)}
export function clearImportCheckpoint(){
  try{localStorage.removeItem(CHECKPOINT_KEY)}catch(e){console.warn("[Cloud Import] checkpoint clear skipped",e?.message||"unknown")}
}
async function parseCsv(file){
  const text=await file.text();
  if(window.Worker){
    try{
      const worker=new Worker("js/workers/csvParserWorker.js");
      const rows=await new Promise((resolve,reject)=>{
        worker.onmessage=e=>e.data?.ok?resolve(e.data.rows):reject(new Error(e.data?.error||"CSV parse failed"));
        worker.onerror=e=>reject(new Error(e.message||"CSV worker failed"));
        worker.postMessage({text});
      });
      worker.terminate();
      return rows;
    }catch(e){console.warn("[Cloud Import] CSV worker fallback",e?.message||"worker failed")}
  }
  return parseCsvSync(text);
}
function parseCsvSync(text){
  const rows=[];let cur=[],val="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'&&q&&n==='"'){val+='"';i++}
    else if(c==='"')q=!q;
    else if(c===","&&!q){cur.push(val);val=""}
    else if((c==="\n"||c==="\r")&&!q){if(val||cur.length){cur.push(val);rows.push(cur);cur=[];val=""}if(c==="\r"&&n==="\n")i++}
    else val+=c;
  }
  if(val||cur.length){cur.push(val);rows.push(cur)}
  return rows.filter(r=>r.some(x=>clean(x)));
}
async function createJob(leagueId,type,file){
  const user=await cloudStore.getCurrentUser();
  if(!user)throw new Error("Sign in before importing cloud data.");
  const row={league_id:leagueId,user_id:user?.id,import_type:type,file_name:file?.name||"",status:"running",rows_processed:0,rows_matched:0,rows_unmatched:0,errors:[],started_at:now()};
  return (await cloudStore.insertRows("import_jobs",[row]))[0];
}
async function updateJob(job,patch){
  if(!job?.id)return;
  try{await cloudStore.updateRow("import_jobs",job.id,patch)}catch(e){console.warn("[Cloud Import] import_jobs update failed",e?.message||"unknown")}
}
function progress(ctx,stage,patch={}){
  const payload={stage,elapsedMs:Date.now()-ctx.startedAt,...patch};
  ctx.onProgress?.(payload);
  saveCheckpoint({leagueId:ctx.leagueId,stage,batch:patch.batch||0,status:patch.status||"running"});
}
function ensureNotCancelled(ctx){if(ctx.cancelled?.())throw new Error("Import cancelled")}

async function cloudMaps(leagueId){
  const [players,teams,managers]=await Promise.all([cloudStore.getPlayers(leagueId),cloudStore.getTeams(leagueId),cloudStore.getManagers(leagueId)]);
  const maps={players,identityIndexes:buildPlayerIdentityIndexes(players),playersByName:new Map(),ambiguousNames:new Set(),playersByMlbam:new Map(),playersByFantrax:new Map(),teams:new Map(),managers:new Map()};
  players.forEach(p=>{
    const nameKey=norm(p.normalized_name||p.name);
    if(nameKey){
      if(maps.playersByName.has(nameKey))maps.ambiguousNames.add(nameKey);
      else maps.playersByName.set(nameKey,p);
    }
    if(p.mlbam_id)maps.playersByMlbam.set(String(p.mlbam_id),p);
    if(p.fantrax_id)maps.playersByFantrax.set(String(p.fantrax_id),p);
  });
  teams.forEach(t=>maps.teams.set(norm(t.name),t));
  managers.forEach(m=>maps.managers.set(norm(m.team_name),m));
  return maps;
}
async function ensureTeams(leagueId,owners,maps){
  const missing=[...new Set(owners.map(cleanOwner).filter(isFantasyTeamName))].filter(name=>!maps.teams.has(norm(name)));
  if(!missing.length)return;
  const rows=missing.map(name=>({league_id:leagueId,name,is_user_team:false}));
  const saved=await cloudStore.upsertRows("teams",rows,"league_id,name");
  saved.forEach(t=>maps.teams.set(norm(t.name),t));
}
function playerMatch(maps,row){
  const resolved=resolvePlayerIdentity(row,maps.identityIndexes||buildPlayerIdentityIndexes(maps.players||[]),{leagueId:row.league_id});
  return resolved.status==="matched"?resolved.player:null;
}
function rememberPlayer(maps,player){
  if(!player?.id)return;
  const existingIndex=maps.players.findIndex(p=>p.id===player.id);
  if(existingIndex>=0)maps.players[existingIndex]=player;
  else maps.players.push(player);
  maps.playersByName.set(norm(player.normalized_name||player.name),player);
  if(player.mlbam_id)maps.playersByMlbam.set(String(player.mlbam_id),player);
  if(player.fantrax_id)maps.playersByFantrax.set(String(player.fantrax_id),player);
  maps.identityIndexes=buildPlayerIdentityIndexes(maps.players);
}
function fantraxConflict(row,resolution){
  return {
    sourceRowNumber:row.source_row_number||0,
    incomingPlayerName:row.name||"",
    incomingFantraxId:row.fantrax_id||"",
    incomingMlbamId:row.mlbam_id||"",
    conflictingInternalPlayerUuids:resolution.conflict?.conflictingPlayerIds||resolution.conflict?.candidates?.map(candidate=>candidate.id).filter(Boolean)||[],
    conflictingPlayerNames:resolution.conflict?.conflictingPlayerNames||resolution.conflict?.candidates?.map(candidate=>candidate.name).filter(Boolean)||[],
    leagueId:row.league_id||"",
    reason:resolution.reason,
    trace:resolution.trace||[]
  };
}
function classifyFantraxRows(playerRows,resolver){
  const prepared=cloudStore.preparePlayerSyncRows(playerRows);
  const updates=[],inserts=[],identityConflicts=[],unmatchedRows=[];
  let matchedByFantrax=0,matchedByMlbam=0,matchedByFallback=0;
  prepared.rows.forEach(row=>{
    const resolution=resolver.resolve(row);
    row.identityResolution=resolution;
    if(resolution.action==="update"&&resolution.matchedPlayerId){
      updates.push({...row,id:resolution.matchedPlayerId});
      if(resolution.matchSource==="fantrax_id")matchedByFantrax++;
      else if(resolution.matchSource==="mlbam_id")matchedByMlbam++;
      else if(resolution.matchSource==="fallback")matchedByFallback++;
      return;
    }
    if(resolution.action==="insert"){
      inserts.push(row);
      return;
    }
    if(resolution.action==="conflict"){
      identityConflicts.push(fantraxConflict(row,resolution));
      return;
    }
    unmatchedRows.push({sourceRowNumber:row.source_row_number||0,name:row.name||"",fantrax_id:row.fantrax_id||"",mlbam_id:row.mlbam_id||"",reason:resolution.reason||"unmatched"});
  });
  return {
    ...prepared,
    updates,
    inserts,
    identityConflicts,
    unmatchedRows,
    matchedByFantrax,
    matchedByMlbam,
    matchedByFallback
  };
}
async function importFantrax({leagueId,file,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,"Fantrax player/roster",file);
  try{
    progress(ctx,"Fantrax player/roster import",{message:"Parsing Fantrax CSV"});
    const rows=await parseCsv(file),head=rows.shift()||[];
    const ix=fantraxPlayerIndexes(head);
    if(ix.fantrax>=0)console.info("[Cloud Import] Fantrax ID column detected and stored as fantrax_id. The Fantrax ID has been manually verified as stable across exports.");
    if(ix.name<0)throw new Error("Fantrax import needs a player/name column.");
    const maps=await cloudMaps(leagueId),owners=rows.map(r=>cleanOwner(cell(r,ix.owner)||cell(r,ix.status)));
    await ensureTeams(leagueId,owners,maps);
    let resolver=new PlayerIdentityResolver({repository:new InMemoryPlayerIdentityRepository(maps.players)});
    let processed=0,matched=0,unmatched=0,inserted=0,updated=0,duplicateFantraxIds=0,duplicateMlbamIds=0,duplicateFallbackKeys=0,matchedByFantrax=0,matchedByMlbam=0,matchedByFallback=0,identityConflicts=0,skippedInvalidRows=0;
    for(const batch of chunk(rows)){
      ensureNotCancelled(ctx);
      const playerRows=[];
      batch.forEach((row,batchIndex)=>{
        const name=cell(row,ix.name);
        if(!name){unmatched++;return}
        const owner=cleanOwner(cell(row,ix.owner)||cell(row,ix.status));
        const fantraxId=textCell(row,ix.fantrax);
        const mlbam=num(cell(row,ix.mlbam));
        const normalized=norm(name);
        playerRows.push(cleanObject({source_row_number:processed+batchIndex+2,league_id:leagueId,fantrax_id:fantraxId,mlbam_id:mlbam,name,normalized_name:normalized,age:num(cell(row,ix.age)),positions:splitPositions(cell(row,ix.pos)),mlb_team:cell(row,ix.org),owner_team_id:isFantasyTeamName(owner)?maps.teams.get(norm(owner))?.id:undefined,roster_status:owner,is_minor_leaguer:/minor|milb|prospect/i.test(cell(row,ix.minor)||cell(row,ix.status)),is_free_agent:owner==="FREE AGENT"}));
      });
      const classified=classifyFantraxRows(playerRows,resolver);
      const {data:saved,meta:writeMeta}=await cloudStore.syncResolvedPlayers({updates:classified.updates,inserts:classified.inserts},{label:"Fantrax player import"});
      saved.forEach(p=>rememberPlayer(maps,p));
      resolver=new PlayerIdentityResolver({repository:new InMemoryPlayerIdentityRepository(maps.players)});
      duplicateFantraxIds+=classified.duplicateFantraxIds||0;
      duplicateMlbamIds+=classified.duplicateMlbamIds||0;
      duplicateFallbackKeys+=classified.duplicateFallbackKeys||0;
      inserted+=writeMeta.inserted||0;
      updated+=writeMeta.updated||0;
      matchedByFantrax+=classified.matchedByFantrax||0;
      matchedByMlbam+=classified.matchedByMlbam||0;
      matchedByFallback+=classified.matchedByFallback||0;
      identityConflicts+=(classified.identityConflicts||[]).length;
      skippedInvalidRows+=(classified.skippedInvalidRows||[]).length;
      unmatched+=(classified.unmatchedRows||[]).length+(classified.identityConflicts||[]).length+(classified.skippedInvalidRows||[]).length;
      processed+=batch.length;matched+=saved.length;
      await updateJob(job,{rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched});
      progress(ctx,"Fantrax player/roster import",{processed,total:rows.length,inserted,updated,matchedByFantrax,matchedByMlbam,matchedByFallback,duplicateFantraxIds,duplicateMlbamIds,duplicateFallbackKeys,unmatched,identityConflicts,skippedInvalidRows,sourceRows:classified.sourceRows,rowsAfterDeduplication:classified.rowsAfterDeduplication,batch:Math.ceil(processed/BATCH_SIZE),message:`Fantrax players ${processed} / ${rows.length}`});
      await sleep();
    }
    await updateJob(job,{status:"completed",rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched,completed_at:now()});
    return{processed,matched,inserted,updated,matchedByFantrax,matchedByMlbam,matchedByFallback,duplicateFantraxIds,duplicateMlbamIds,duplicateFallbackKeys,unmatched,identityConflicts,skippedInvalidRows};
  }catch(e){
    await updateJob(job,{status:"failed",error_message:e.message,completed_at:now()});
    throw e;
  }
}
async function importHkb({leagueId,file,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,"HarryKnowsBall values",file);
  try{
    const rows=await parseCsv(file),head=rows.shift()||[],map=headerMap(head),maps=await cloudMaps(leagueId);
    const ix={name:map.find(["name","player","player name"]),fantrax:map.find(["fantrax id","fantrax player id"]),mlbam:exactHeaderIndex(head,["MLBAM ID","MLB ID","MLB Player ID"]),value:map.find(["hkb value","value","dynasty value"]),overall:map.find(["overall rank","rank","overall"]),posRank:map.find(["position rank","pos rank"])};
    let processed=0,matched=0,unmatched=0,updated=0;
    for(const batch of chunk(rows)){
      ensureNotCancelled(ctx);
      const updates=[];
      batch.forEach(row=>{
        const name=cell(row,ix.name),fantraxId=textCell(row,ix.fantrax),mlbam=num(cell(row,ix.mlbam)),existing=playerMatch(maps,{league_id:leagueId,fantrax_id:fantraxId,mlbam_id:mlbam,normalized_name:norm(name),name});
        if(!existing){unmatched++;return}
        matched++;updated++;
        updates.push(cleanObject({id:existing.id,league_id:leagueId,name:existing.name,normalized_name:existing.normalized_name,hkb_value:num(cell(row,ix.value)),overall_rank:num(cell(row,ix.overall)),position_rank:num(cell(row,ix.posRank))}));
      });
      for(const update of updates){
        await cloudStore.updateRow("players",update.id,update);
      }
      processed+=batch.length;
      await updateJob(job,{rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched});
      progress(ctx,"HarryKnowsBall values import",{processed,total:rows.length,updated,unmatched,message:`HKB values ${processed} / ${rows.length}`});
      await sleep();
    }
    await updateJob(job,{status:"completed",rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched,completed_at:now()});
    return{processed,matched,updated,unmatched};
  }catch(e){await updateJob(job,{status:"failed",error_message:e.message,completed_at:now()});throw e}
}
const hitterMetrics=["xba","xslg","xwoba","xobp","xiso","exit_velocity_avg","launch_angle_avg","sweet_spot_percent","barrel_batted_rate","hard_hit_percent","whiff_percent","k_percent","bb_percent","avg_swing_speed","fast_swing_rate","attack_angle","attack_direction","ideal_angle_rate","vertical_swing_path"];
const pitcherMetrics=["p_era","xera","xba","xslg","xwoba","exit_velocity_avg","launch_angle_avg","barrel_batted_rate","hard_hit_percent","whiff_percent","k_percent","bb_percent","n_ff_formatted","n_sl_formatted","n_ch_formatted","release_speed","pfx_x","pfx_z"];
function statcastName(row,map){
  const combined=map.find(["last_name, first_name","player_name","name"]);
  if(combined>=0){
    const value=cell(row,combined);
    if(value.includes(",")){const [last,first]=value.split(",");return`${clean(first)} ${clean(last)}`.trim()}
    return value;
  }
  return `${cell(row,map.find("first_name"))} ${cell(row,map.find("last_name"))}`.trim();
}
async function importStatcast({leagueId,file,type,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,`Statcast ${type}`,file);
  try{
    const rows=await parseCsv(file),head=rows.shift()||[],map=headerMap(head),maps=await cloudMaps(leagueId);
    const playerIx=map.find(["player_id","mlbam","mlbam id"]),seasonIx=map.find(["year","season"]);
    const metricKeys=type==="pitcher"?pitcherMetrics:hitterMetrics;
    let processed=0,matched=0,unmatched=0,updated=0;
    for(const batch of chunk(rows)){
      ensureNotCancelled(ctx);
      const metricRows=[];
      batch.forEach(row=>{
        const playerId=num(cell(row,playerIx)),name=statcastName(row,map),existing=playerMatch(maps,{league_id:leagueId,mlbam_id:playerId,normalized_name:norm(name),name});
        if(!existing){unmatched++;return}
        const metrics={};
        metricKeys.forEach(key=>{const ix=map.find(key);if(ix>=0&&cell(row,ix)!=="")metrics[key]=num(cell(row,ix))??cell(row,ix)});
        if(!Object.keys(metrics).length){unmatched++;return}
        matched++;updated++;
        metricRows.push({league_id:leagueId,player_id:existing.id,source:"Statcast",season:num(cell(row,seasonIx))||new Date().getFullYear(),metric_type:type==="pitcher"?"statcast_pitching":"statcast_hitting",metrics,imported_at:now()});
      });
      await cloudStore.upsertRows("player_metrics",metricRows,"player_id,source,season,metric_type");
      processed+=batch.length;
      await updateJob(job,{rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched});
      progress(ctx,`Statcast ${type} import`,{processed,total:rows.length,updated,unmatched,message:`Statcast ${type} ${processed} / ${rows.length}`});
      await sleep();
    }
    await updateJob(job,{status:"completed",rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched,completed_at:now()});
    return{processed,matched,updated,unmatched};
  }catch(e){await updateJob(job,{status:"failed",error_message:e.message,completed_at:now()});throw e}
}
function splitPlayers(value){return clean(value).split(/\s*(?:;|\n|\+|,|\band\b)\s*/i).map(x=>x.replace(/\s*\([^)]*\)\s*/g," ").trim()).filter(Boolean)}
function tradeFingerprint(parts){
  return norm([parts.date,parts.to,parts.from,...(parts.players||[])].join("|"));
}
async function importTrades({leagueId,file,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,"Fantrax trade history",file);
  try{
    const rows=await parseCsv(file),head=rows.shift()||[],map=headerMap(head),maps=await cloudMaps(leagueId);
    const ix={date:map.find(["date","transaction date","processed","timestamp"]),type:map.find(["transaction type","type","action","transaction"]),to:map.find(["to","to team","receiving team","team/manager receiving players","new team","team"]),from:map.find(["from","from team","sending team","team/manager sending players","old team"]),player:map.find(["player","players","player name","asset","name"]),notes:map.find(["notes","details","description","transaction details"]),id:map.find(["transaction id","transaction #","id","trade id"])};
    const grouped=new Map();
    rows.forEach(row=>{
      const to=cleanOwner(cell(row,ix.to)),from=cleanOwner(cell(row,ix.from)),date=cell(row,ix.date).slice(0,10),players=splitPlayers(cell(row,ix.player)||cell(row,ix.notes)),external=cell(row,ix.id);
      const key=external||tradeFingerprint({date,to,from,players});
      const current=grouped.get(key)||{date,type:cell(row,ix.type)||"Trade",to,from,notes:cell(row,ix.notes),players:[],external_transaction_id:key};
      current.players.push(...players);
      grouped.set(key,current);
    });
    const groups=[...grouped.values()];
    let processed=0,matched=0,unmatched=0,inserted=0;
    for(const group of groups){
      ensureNotCancelled(ctx);
      await ensureTeams(leagueId,[group.to,group.from],maps);
      const trade=(await cloudStore.upsertRows("trades",[cleanObject({league_id:leagueId,transaction_date:group.date,team_a_id:maps.teams.get(norm(group.to))?.id,team_b_id:maps.teams.get(norm(group.from))?.id,trade_type:group.type,notes:group.notes,source:"Fantrax CSV",external_transaction_id:group.external_transaction_id})],"league_id,external_transaction_id"))[0];
      for(const playerName of [...new Set(group.players)]){
        const player=maps.playersByName.get(norm(playerName));
        if(player)matched++;else unmatched++;
        await cloudStore.insertRows("trade_assets",[cleanObject({league_id:leagueId,trade_id:trade.id,player_id:player?.id,player_name:playerName,from_team_id:maps.teams.get(norm(group.from))?.id,to_team_id:maps.teams.get(norm(group.to))?.id,asset_type:"player"})]);
      }
      processed++;inserted++;
      if(processed%BATCH_SIZE===0){await updateJob(job,{rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched});progress(ctx,"Fantrax trade-history import",{processed,total:groups.length,inserted,unmatched,message:`Trades ${processed} / ${groups.length}`});await sleep()}
    }
    await updateJob(job,{status:"completed",rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched,completed_at:now()});
    progress(ctx,"Fantrax trade-history import",{processed,total:groups.length,inserted,unmatched,message:`Trades ${processed} / ${groups.length}`});
    return{processed,matched,inserted,unmatched};
  }catch(e){await updateJob(job,{status:"failed",error_message:e.message,completed_at:now()});throw e}
}
async function migrateCustom({leagueId,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,"Local custom data",null);
  try{
    progress(ctx,"Local custom-data migration",{message:"Migrating manager profiles, preferences, notes, settings, and manual trade notes"});
    const db=window.db||{};
    const managers=db.managers||[];
    const managerRows=managers.map(manager=>cleanObject({
      league_id:leagueId,
      team_name:cleanOwner(manager.teamName||manager.owner||manager.team),
      manager_name:manager.managerName,
      competitive_window:manager.competitiveWindow,
      trade_style:manager.tradeStyle,
      hkb_reliance:manager.hkbReliance,
      preferred_player_types:String(manager.preferredPlayerTypes||"").split(/\n|,/).map(clean).filter(Boolean),
      favorite_prospects:String(manager.favoriteProspects||"").split(/\n|,/).map(clean).filter(Boolean),
      favorite_mlb_teams:String(manager.favoriteMLBTeams||"").split(/\n|,/).map(clean).filter(Boolean),
      negotiation_notes:manager.negotiationNotes,
      communication_style:manager.communicationStyle,
      highly_valued_players:String(manager.playersHighlyValue||"").split(/\n|,/).map(clean).filter(Boolean),
      willing_to_move_players:String(manager.playersWillingToMove||"").split(/\n|,/).map(clean).filter(Boolean),
      trade_history_notes:manager.tradeHistoryNotes
    })).filter(row=>row.team_name);
    const savedManagers=await cloudStore.upsertRows("managers",managerRows,"league_id,team_name");
    const managerMap=new Map(savedManagers.map(m=>[norm(m.team_name),m]));
    let preferences=0,notes=0,manualTrades=0;
    const players=await cloudStore.getPlayers(leagueId),playerMap=new Map(players.map(p=>[norm(p.normalized_name||p.name),p]));
    for(const manager of managers){
      const cloudManager=managerMap.get(norm(manager.teamName));
      if(!cloudManager)continue;
      const prefs=[
        ...String(manager.playersHighlyValue||"").split(/\n|,/).map(name=>({name:clean(name),type:"highly_values"})),
        ...String(manager.playersWillingToMove||"").split(/\n|,/).map(name=>({name:clean(name),type:"willing_to_move"})),
        ...String(manager.favoriteProspects||"").split(/\n|,/).map(name=>({name:clean(name),type:"favorite_prospect"}))
      ].filter(x=>x.name);
      if(prefs.length){
        const rows=prefs.map(pref=>cleanObject({league_id:leagueId,manager_id:cloudManager.id,player_id:playerMap.get(norm(pref.name))?.id,player_name:pref.name,preference_type:pref.type,strength:4,notes:"Imported from local manager profile."}));
        preferences+=(await cloudStore.insertRows("manager_preferences",rows)).length;
      }
    }
    for(const localPlayer of db.players||[]){
      if(!localPlayer.notes)continue;
      const cloudPlayer=playerMap.get(norm(localPlayer.name));
      if(!cloudPlayer)continue;
      await cloudStore.updateRow("players",cloudPlayer.id,{notes:localPlayer.notes});
      notes++;
    }
    for(const trade of (db.trades||[]).filter(t=>t.source==="Manual"||t.notes)){
      const row=cleanObject({league_id:leagueId,transaction_date:String(trade.date||now()).slice(0,10),trade_type:trade.type||"Trade",notes:trade.notes,source:trade.source||"Local custom note",external_transaction_id:trade.id});
      await cloudStore.insertRows("trades",[row]);
      manualTrades++;
    }
    await updateJob(job,{status:"completed",rows_processed:managers.length+(db.players||[]).length+(db.trades||[]).length,rows_matched:savedManagers.length+preferences+notes+manualTrades,rows_unmatched:0,error_message:"Local custom data migrated without copying incomplete player caches.",completed_at:now()});
    const result={processed:managers.length,matched:savedManagers.length,inserted:savedManagers.length+preferences+manualTrades,updated:notes,unmatched:0};
    progress(ctx,"Local custom-data migration",{...result,message:"Local custom data migrated"});
    return result;
  }catch(e){
    await updateJob(job,{status:"failed",error_message:e.message,completed_at:now()});
    throw e;
  }
}
function detectCsvSource(head){
  const map=headerMap(head);
  if(map.find(["last_name, first_name","player_id"])>=0&&(map.find("exit_velocity_avg")>=0||map.find("xwoba")>=0))return "Statcast";
  if(map.find(["hkb value","dynasty value","overall rank"])>=0)return "HarryKnowsBall";
  if(map.find(["transaction id","transaction #","transaction type","transaction details"])>=0)return "Fantrax trade history";
  if(map.find(["status","owner","roster status"])>=0&&map.find(["player","player name","name"])>=0)return "Fantrax player pool and roster";
  return "Unknown CSV";
}
function duplicateKeys(rows,keyer){
  const seen=new Set(),dupes=new Set();
  rows.forEach(row=>{
    const key=keyer(row);
    if(!key)return;
    if(seen.has(key))dupes.add(key);
    seen.add(key);
  });
  return dupes;
}
function previewBase(file,head,rows,sourceType,validRows,invalidRows,duplicates,matched,unmatched,blocking=[],warnings=[]){
  return {
    fileName:file?.name||"",
    sourceType,
    columns:head,
    totalRows:rows.length,
    validRows,
    invalidRows,
    duplicateRows:duplicates.size||0,
    matchedRecords:matched,
    unmatchedRecords:unmatched,
    estimatedBatches:Math.max(1,Math.ceil(validRows/BATCH_SIZE)),
    blockingErrors:blocking,
    warnings
  };
}
async function previewFantrax(leagueId,file,rows,head){
  const maps=await cloudMaps(leagueId);
  const ix=fantraxPlayerIndexes(head);
  const blocking=[],warnings=[];
  if(ix.name<0)blocking.push("Fantrax import needs a Player or Name column.");
  if(ix.owner<0&&ix.status<0)warnings.push("No Status/owner column detected; rows will be treated as free agents.");
  const validRows=ix.name<0?0:rows.filter(row=>cell(row,ix.name)).length;
  const invalidRows=rows.length-validRows;
  if(ix.fantrax>=0)warnings.push("Fantrax ID column detected and will be stored as fantrax_id. It has been manually verified as stable across multiple Fantrax exports.");
  const dupes=duplicateKeys(rows,row=>textCell(row,ix.fantrax)||cell(row,ix.mlbam)||norm(cell(row,ix.name)));
  let matched=0;
  rows.forEach(row=>{const fantraxId=textCell(row,ix.fantrax);if(playerMatch(maps,{league_id:leagueId,fantrax_id:fantraxId,mlbam_id:num(cell(row,ix.mlbam)),normalized_name:norm(cell(row,ix.name)),name:cell(row,ix.name)}))matched++});
  return previewBase(file,head,rows,"Fantrax player pool and roster",validRows,invalidRows,dupes,matched,validRows-matched,blocking,warnings);
}
export async function dryRunFantraxIdBackfill({leagueId,file}){
  if(!leagueId)throw new Error("Select a cloud league before running Fantrax ID backfill.");
  if(!file)throw new Error("Choose a Fantrax player export before running Fantrax ID backfill.");
  const parsed=await parseCsv(file),head=parsed.shift()||[],rows=parsed,ix=fantraxPlayerIndexes(head);
  if(ix.name<0)throw new Error("Fantrax backfill needs a player/name column.");
  if(ix.fantrax<0)throw new Error("Fantrax backfill needs an ID, Fantrax ID, or Fantrax Player ID column.");
  const players=await cloudStore.getPlayers(leagueId);
  const indexes=buildPlayerIdentityIndexes(players);
  const report={safelyBackfilled:[],alreadyPopulated:[],ambiguous:[],unmatched:[],conflicts:[]};
  rows.forEach((row,index)=>{
    const fantraxId=textCell(row,ix.fantrax);
    const name=cell(row,ix.name);
    if(!fantraxId||!name)return;
    const incoming=cleanObject({
      league_id:leagueId,
      fantrax_id:fantraxId,
      mlbam_id:num(cell(row,ix.mlbam)),
      name,
      normalized_name:norm(name),
      positions:splitPositions(cell(row,ix.pos)),
      mlb_team:cell(row,ix.org)
    });
    const resolved=resolvePlayerIdentity(incoming,indexes,{leagueId,rowNumber:index+2});
    if(resolved.status==="conflict"){
      report.conflicts.push(resolved.conflict);
      return;
    }
    if(resolved.status!=="matched"||!resolved.player?.id){
      report.unmatched.push({sourceRowNumber:index+2,incomingPlayerName:name,incomingFantraxId:fantraxId,incomingMlbamId:incoming.mlbam_id||"",leagueId});
      return;
    }
    if(resolved.player.fantrax_id){
      report.alreadyPopulated.push({playerId:resolved.player.id,name:resolved.player.name,fantraxId:resolved.player.fantrax_id});
      return;
    }
    if(resolved.matchType==="fallback"&&!incoming.mlbam_id){
      report.ambiguous.push({sourceRowNumber:index+2,incomingPlayerName:name,incomingFantraxId:fantraxId,matchedPlayerId:resolved.player.id,matchedPlayerName:resolved.player.name,reason:"fallback_without_mlbam_context"});
      return;
    }
    report.safelyBackfilled.push({playerId:resolved.player.id,name:resolved.player.name,fantraxId,matchedBy:resolved.matchType});
  });
  return report;
}
async function previewHkb(leagueId,file,rows,head){
  const map=headerMap(head),maps=await cloudMaps(leagueId);
  const ix={name:map.find(["name","player","player name"]),fantrax:map.find(["fantrax id","fantrax player id"]),mlbam:exactHeaderIndex(head,["MLBAM ID","MLB ID","MLB Player ID"]),value:map.find(["hkb value","value","dynasty value"])};
  const blocking=[],warnings=[];
  if(ix.name<0)blocking.push("HarryKnowsBall import needs a player/name column.");
  if(ix.value<0)blocking.push("HarryKnowsBall import needs an HKB value column.");
  let matched=0,unmatched=0,validRows=0;
  rows.forEach(row=>{
    const name=cell(row,ix.name);
    if(!name)return;
    validRows++;
    const fantraxId=textCell(row,ix.fantrax);
    if(playerMatch(maps,{league_id:leagueId,fantrax_id:fantraxId,mlbam_id:num(cell(row,ix.mlbam)),normalized_name:norm(name),name}))matched++;else unmatched++;
  });
  if(!matched)warnings.push("No HKB rows matched current cloud players. Run Fantrax first or review names.");
  return previewBase(file,head,rows,"HarryKnowsBall values",validRows,rows.length-validRows,duplicateKeys(rows,row=>textCell(row,ix.fantrax)||cell(row,ix.mlbam)||norm(cell(row,ix.name))),matched,unmatched,blocking,warnings);
}
async function previewStatcast(leagueId,file,rows,head,expectedType){
  const map=headerMap(head),maps=await cloudMaps(leagueId);
  const playerIx=map.find(["player_id","mlbam","mlbam id"]);
  const keys=expectedType==="pitcher"?pitcherMetrics:hitterMetrics;
  const detectedPitcher=head.some(h=>pitcherMetrics.includes(keyify(h)))&&map.find("p_era")>=0;
  const detectedType=detectedPitcher?"pitcher":"hitter";
  const blocking=[],warnings=[];
  if(playerIx<0)warnings.push("No player_id column detected; import will rely on normalized names.");
  if(detectedType!==expectedType)warnings.push(`This looks like a Statcast ${detectedType} export, but this stage is ${expectedType}.`);
  if(!keys.some(key=>map.find(key)>=0))blocking.push("No supported Statcast metric columns were detected.");
  let matched=0,unmatched=0,validRows=0;
  rows.forEach(row=>{
    const name=statcastName(row,map);
    const hasMetric=keys.some(key=>map.find(key)>=0&&cell(row,map.find(key))!=="");
    if(!hasMetric)return;
    validRows++;
    if(playerMatch(maps,{league_id:leagueId,mlbam_id:num(cell(row,playerIx)),normalized_name:norm(name),name}))matched++;else unmatched++;
  });
  return previewBase(file,head,rows,`Statcast ${expectedType}`,validRows,rows.length-validRows,duplicateKeys(rows,row=>cell(row,playerIx)||norm(statcastName(row,map))),matched,unmatched,blocking,warnings);
}
async function previewTrades(leagueId,file,rows,head){
  const map=headerMap(head),maps=await cloudMaps(leagueId);
  const ix={date:map.find(["date","transaction date","processed","timestamp"]),to:map.find(["to","to team","receiving team","team/manager receiving players","new team","team"]),from:map.find(["from","from team","sending team","team/manager sending players","old team"]),player:map.find(["player","players","player name","asset","name"]),notes:map.find(["notes","details","description","transaction details"]),id:map.find(["transaction id","transaction #","id","trade id"])};
  const blocking=[],warnings=[];
  if(ix.date<0)warnings.push("No transaction date column detected.");
  if(ix.player<0&&ix.notes<0)blocking.push("Trade history needs a player/assets or transaction details column.");
  let matched=0,unmatched=0,validRows=0;
  rows.forEach(row=>{
    const names=splitPlayers(cell(row,ix.player)||cell(row,ix.notes));
    if(!names.length)return;
    validRows++;
    names.forEach(name=>maps.playersByName.get(norm(name))?matched++:unmatched++);
  });
  return previewBase(file,head,rows,"Fantrax trade history",validRows,rows.length-validRows,duplicateKeys(rows,row=>cell(row,ix.id)||`${cell(row,ix.date)}:${cell(row,ix.to)}:${cell(row,ix.from)}:${cell(row,ix.player)||cell(row,ix.notes)}`),matched,unmatched,blocking,warnings);
}
async function previewCustomJson(file){
  const blocking=[],warnings=[];
  let payload=null;
  try{payload=JSON.parse(await file.text())}catch(e){blocking.push("Custom Intelligence file is not valid JSON.")}
  if(payload?.exportType!=="dynasty-custom-intelligence")blocking.push("Custom Intelligence JSON must have exportType dynasty-custom-intelligence.");
  if(payload?.schemaVersion&&!String(payload.schemaVersion).startsWith("1."))warnings.push(`Schema version ${payload.schemaVersion} may need review.`);
  const categories=["managerProfiles","managerPreferences","customPlayerNotes","manualScouting","tradeNotes","favorites","watchlists","pinnedItems","manualOverrides","workflowNotes"];
  const total=categories.reduce((sum,key)=>sum+(Array.isArray(payload?.[key])?payload[key].length:0),0);
  return {...previewBase(file,[],[], "Custom Intelligence JSON",total,0,new Set(),0,total,blocking,warnings),schemaVersion:payload?.schemaVersion||"",categories:Object.fromEntries(categories.map(key=>[key,Array.isArray(payload?.[key])?payload[key].length:0]))};
}
export async function previewStep({step,leagueId,file}){
  if(step==="custom")return previewCustomJson(file);
  if(!file)throw new Error("Choose a file before previewing this import step.");
  const parsed=await parseCsv(file),head=parsed.shift()||[],rows=parsed;
  const detected=detectCsvSource(head);
  if(step==="fantrax")return previewFantrax(leagueId,file,rows,head);
  if(step==="hkb")return previewHkb(leagueId,file,rows,head);
  if(step==="statcastHitters")return previewStatcast(leagueId,file,rows,head,"hitter");
  if(step==="statcastPitchers")return previewStatcast(leagueId,file,rows,head,"pitcher");
  if(step==="trades")return previewTrades(leagueId,file,rows,head);
  return previewBase(file,head,rows,detected,rows.length,0,new Set(),0,rows.length,["Unknown import step."],[]);
}
async function importCustomJson({leagueId,file,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,"Custom Intelligence JSON",file);
  try{
    ensureNotCancelled(ctx);
    progress(ctx,"Custom Intelligence JSON import",{message:"Parsing Custom Intelligence JSON"});
    const payload=JSON.parse(await file.text());
    if(payload?.exportType!=="dynasty-custom-intelligence")throw new Error("Custom Intelligence JSON must have exportType dynasty-custom-intelligence.");
    const managerProfiles=Array.isArray(payload.managerProfiles)?payload.managerProfiles:[];
    const managerRows=managerProfiles.map(manager=>cleanObject({
      league_id:leagueId,
      team_name:manager.teamName,
      manager_name:manager.managerName,
      competitive_window:manager.competitiveWindow,
      trade_style:manager.tradeStyle,
      hkb_reliance:manager.hkbReliance,
      preferred_player_types:stringArray(manager.preferredPlayerTypes),
      favorite_prospects:stringArray(manager.favoriteProspects),
      favorite_mlb_teams:stringArray(manager.favoriteMLBTeams),
      negotiation_notes:manager.negotiationNotes,
      communication_style:manager.communicationStyle,
      highly_valued_players:stringArray(manager.playersHighlyValue),
      willing_to_move_players:stringArray(manager.playersWillingToMove),
      trade_history_notes:manager.tradeHistoryNotes
    })).filter(row=>row.team_name);
    const savedManagers=await cloudStore.upsertRows("managers",managerRows,"league_id,team_name");
    const managerMap=new Map(savedManagers.map(m=>[norm(m.team_name),m]));
    const players=await cloudStore.getPlayers(leagueId),playerMap=new Map(players.map(p=>[norm(p.normalized_name||p.name),p]));
    const preferenceRows=(payload.managerPreferences||[]).map(pref=>{
      const manager=managerMap.get(norm(pref.managerTeamName));
      return cleanObject({league_id:leagueId,manager_id:manager?.id,player_id:playerMap.get(norm(pref.playerName))?.id,player_name:pref.playerName,preference_type:pref.preferenceType,strength:pref.strength,notes:pref.notes});
    }).filter(row=>row.manager_id);
    const savedPrefs=await cloudStore.insertRows("manager_preferences",preferenceRows);
    let noteUpdates=0;
    for(const note of [...(payload.customPlayerNotes||[]),...(payload.manualScouting||[])]){
      ensureNotCancelled(ctx);
      const player=playerMap.get(norm(note.normalizedName||note.playerName));
      if(!player)continue;
      await cloudStore.updateRow("players",player.id,cleanObject({notes:note.notes}));
      noteUpdates++;
    }
    let tradeNotes=0;
    const tradeRows=(payload.tradeNotes||[]).map(trade=>cleanObject({league_id:leagueId,transaction_date:String(trade.date||now()).slice(0,10),trade_type:trade.type||"Manual note",notes:trade.notes,source:trade.source||"Custom Intelligence JSON",external_transaction_id:trade.id}));
    if(tradeRows.length)tradeNotes=(await cloudStore.insertRows("trades",tradeRows)).length;
    const settingPatch={custom_intelligence:{favorites:payload.favorites||[],watchlists:payload.watchlists||[],pinnedItems:payload.pinnedItems||[],manualOverrides:payload.manualOverrides||[],userPreferences:payload.userPreferences||{},league:payload.league||{},manualScouting:payload.manualScouting||[],customPlayerNotes:payload.customPlayerNotes||[],workflowNotes:payload.workflowNotes||[],importedAt:now()}};
    await cloudStore.updateLeagueSettings(leagueId,settingPatch).catch(e=>console.warn("[Cloud Import] league preference import skipped",e?.message||"unknown"));
    const processed=managerProfiles.length+(payload.managerPreferences||[]).length+(payload.customPlayerNotes||[]).length+(payload.manualScouting||[]).length+(payload.tradeNotes||[]).length;
    const matched=savedManagers.length+savedPrefs.length+noteUpdates+tradeNotes;
    await updateJob(job,{status:"completed",rows_processed:processed,rows_matched:matched,rows_unmatched:Math.max(0,processed-matched),completed_at:now()});
    progress(ctx,"Custom Intelligence JSON import",{processed,total:processed,inserted:savedManagers.length+savedPrefs.length+tradeNotes,updated:noteUpdates,unmatched:Math.max(0,processed-matched),message:"Custom Intelligence imported"});
    return{processed,matched,inserted:savedManagers.length+savedPrefs.length+tradeNotes,updated:noteUpdates,unmatched:Math.max(0,processed-matched)};
  }catch(e){await updateJob(job,{status:"failed",error_message:e.message,completed_at:now()});throw e}
}
function stringArray(value){
  if(Array.isArray(value))return value.map(clean).filter(Boolean);
  return String(value||"").split(/\n|,/).map(clean).filter(Boolean);
}
async function verify({leagueId,onProgress}){
  const user=await cloudStore.getCurrentUser();
  const counts=await cloudStore.getLeagueCounts(leagueId);
  const [league,memberships,teams,managers,players,metrics,trades,assets]=await Promise.all([cloudStore.getLeague(leagueId),cloudStore.getLeagueMemberships(leagueId),cloudStore.getTeams(leagueId),cloudStore.getManagers(leagueId),cloudStore.getPlayers(leagueId),cloudStore.selectRows("player_metrics",leagueId),cloudStore.getTrades(leagueId),cloudStore.selectRows("trade_assets",leagueId)]);
  const playerIds=new Set(players.map(p=>p.id)),tradeIds=new Set(trades.map(t=>t.id));
  const teamIds=new Set(teams.map(t=>t.id));
  const fantraxSeen=new Set(),fantraxDupes=new Set(),mlbamSeen=new Set(),mlbamDupes=new Set(),nameSeen=new Set(),nameDupes=new Set();
  players.forEach(player=>{
    if(player.fantrax_id){
      const key=String(player.fantrax_id);
      if(fantraxSeen.has(key))fantraxDupes.add(key);
      fantraxSeen.add(key);
    }
    if(player.mlbam_id){
      const key=String(player.mlbam_id);
      if(mlbamSeen.has(key))mlbamDupes.add(key);
      mlbamSeen.add(key);
    }
    const name=norm(player.normalized_name||player.name);
    if(name){
      if(nameSeen.has(name))nameDupes.add(name);
      nameSeen.add(name);
    }
  });
  const invalidNumbers=players.filter(player=>["age","hkb_value","overall_rank","position_rank"].some(field=>player[field]!==null&&player[field]!==undefined&&Number.isNaN(Number(player[field]))));
  const hitting=metrics.filter(m=>m.metric_type==="statcast_hitting");
  const pitching=metrics.filter(m=>m.metric_type==="statcast_pitching");
  const ownedInvalid=players.filter(p=>p.owner_team_id&&!teamIds.has(p.owner_team_id));
  const freeAgentInvalid=players.filter(p=>p.is_free_agent&&p.owner_team_id);
  const checks=[
    {name:"Cloud league exists",status:league?"PASS":"FAIL",detail:league?.name||"No league found"},
    {name:"Owner membership exists",status:memberships.some(m=>m.user_id===user?.id)?"PASS":"FAIL",detail:`${memberships.length} memberships`},
    {name:"Fantasy teams exist",status:teams.length>0?"PASS":"FAIL",detail:`${teams.length} teams`},
    {name:"Player count is plausible",status:players.length>=500?"PASS":players.length>0?"WARNING":"FAIL",detail:`${players.length} players`},
    {name:"Every owned player references a valid team",status:ownedInvalid.length?"FAIL":"PASS",detail:`${ownedInvalid.length} invalid owned players`},
    {name:"Free agents intentionally have no owner_team_id",status:freeAgentInvalid.length?"FAIL":"PASS",detail:`${freeAgentInvalid.length} free agents with owners`},
    {name:"HKB metrics matched to players",status:players.some(p=>p.hkb_value!==null&&p.hkb_value!==undefined)?"PASS":"WARNING",detail:"At least one player has HKB value"},
    {name:"Statcast hitter metrics reference valid players",status:hitting.every(m=>playerIds.has(m.player_id))?"PASS":"FAIL",detail:`${hitting.length} hitter metrics`},
    {name:"Statcast pitcher metrics reference valid players",status:pitching.every(m=>playerIds.has(m.player_id))?"PASS":"FAIL",detail:`${pitching.length} pitcher metrics`},
    {name:"Trade assets reference valid trades",status:assets.every(a=>tradeIds.has(a.trade_id))?"PASS":"FAIL",detail:`${assets.length} assets`},
    {name:"Duplicate Fantrax IDs",status:fantraxDupes.size?"FAIL":"PASS",detail:`${fantraxDupes.size} duplicates`},
    {name:"Duplicate MLBAM IDs",status:mlbamDupes.size?"FAIL":"PASS",detail:`${mlbamDupes.size} duplicates`},
    {name:"Duplicate normalized player names",status:nameDupes.size?"WARNING":"PASS",detail:`${nameDupes.size} duplicates`},
    {name:"Orphaned metrics",status:metrics.every(m=>playerIds.has(m.player_id))?"PASS":"FAIL",detail:`${metrics.filter(m=>!playerIds.has(m.player_id)).length} orphaned metrics`},
    {name:"Invalid numeric values",status:invalidNumbers.length?"WARNING":"PASS",detail:`${invalidNumbers.length} player rows`},
    {name:"Custom manager profiles imported",status:managers.length?"PASS":"WARNING",detail:`${managers.length} managers`},
    {name:"RLS access works for the signed-in user",status:user&&league?"PASS":"FAIL",detail:user?"Authenticated requests succeeded":"No signed-in user"}
  ];
  const passed=checks.every(c=>c.status!=="FAIL");
  onProgress?.({stage:"Verification",checks,counts,passed,message:passed?"Verification passed":"Verification needs review"});
  return{checks,counts,passed};
}
export const cloudImportStages={order:STEP_ORDER,labels:STEP_LABELS,batchSize:BATCH_SIZE,checkpointKey:CHECKPOINT_KEY};
export async function runStep({step,leagueId,file,onProgress,cancelled=()=>false}){
  if(!leagueId&&step!=="verification")throw new Error("Select or create a cloud league first.");
  const args={leagueId,file,onProgress,cancelled};
  if(step==="fantrax")return importFantrax(args);
  if(step==="hkb")return importHkb(args);
  if(step==="statcastHitters")return importStatcast({...args,type:"hitter"});
  if(step==="statcastPitchers")return importStatcast({...args,type:"pitcher"});
  if(step==="trades")return importTrades(args);
  if(step==="custom")return importCustomJson(args);
  if(step==="verification")return verify(args);
  throw new Error(`Unknown cloud import step: ${step}`);
}
