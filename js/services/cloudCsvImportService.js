import * as cloudStore from "./cloudStore.js";

const BATCH_SIZE=150;
const CHECKPOINT_KEY="dynasty_cloud_import_checkpoint_v1";

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
function cell(row,ix){return ix>=0?clean(row[ix]):""}
function splitPositions(value){return clean(value).split(/[\/,\s]+/).map(x=>x.trim()).filter(Boolean)}
function saveCheckpoint(patch){
  try{
    const current=JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||"{}");
    localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({...current,...patch,updatedAt:now()}));
  }catch(e){console.warn("[Cloud Import] checkpoint skipped",e?.message||"unknown")}
}
export function getCheckpoint(){
  try{return JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||"{}")}catch(e){return{}}
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
  const row={league_id:leagueId,user_id:user?.id,import_type:type,file_name:file?.name||"",status:"running",rows_processed:0,rows_matched:0,rows_unmatched:0,started_at:now()};
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
  const maps={playersByName:new Map(),playersByMlbam:new Map(),teams:new Map(),managers:new Map()};
  players.forEach(p=>{maps.playersByName.set(norm(p.normalized_name||p.name),p);if(p.mlbam_id)maps.playersByMlbam.set(String(p.mlbam_id),p)});
  teams.forEach(t=>maps.teams.set(norm(t.name),t));
  managers.forEach(m=>maps.managers.set(norm(m.team_name),m));
  return maps;
}
async function ensureTeams(leagueId,owners,maps){
  const missing=[...new Set(owners.map(cleanOwner).filter(Boolean))].filter(name=>!maps.teams.has(norm(name)));
  if(!missing.length)return;
  const rows=missing.map(name=>({league_id:leagueId,name,is_user_team:false}));
  const saved=await cloudStore.upsertRows("teams",rows,"league_id,name");
  saved.forEach(t=>maps.teams.set(norm(t.name),t));
}
function playerMatch(maps,row){
  const id=row.mlbam_id?maps.playersByMlbam.get(String(row.mlbam_id)):null;
  return id||maps.playersByName.get(norm(row.normalized_name||row.name));
}
async function importFantrax({leagueId,file,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,"Fantrax player/roster",file);
  try{
    progress(ctx,"Fantrax player/roster import",{message:"Parsing Fantrax CSV"});
    const rows=await parseCsv(file),head=rows.shift()||[],map=headerMap(head);
    const ix={name:map.find(["player","player name","name"]),owner:map.find(["status","owner","fantasy team","team owner","roster status"]),pos:map.find(["position","positions","pos"]),org:map.find(["team","mlb team","org","organization"]),age:map.find(["age"]),mlbam:map.find(["player_id","mlbam","mlbam id","mlb id","id"]),status:map.find(["status","roster status"]),minor:map.find(["minor","minors","minor league","level"])};
    if(ix.name<0)throw new Error("Fantrax import needs a player/name column.");
    const maps=await cloudMaps(leagueId),owners=rows.map(r=>cleanOwner(cell(r,ix.owner)||cell(r,ix.status)));
    await ensureTeams(leagueId,owners,maps);
    let processed=0,matched=0,unmatched=0,inserted=0,updated=0,duplicate=0;
    for(const batch of chunk(rows)){
      ensureNotCancelled(ctx);
      const playerRows=[];
      batch.forEach(row=>{
        const name=cell(row,ix.name);
        if(!name){unmatched++;return}
        const owner=cleanOwner(cell(row,ix.owner)||cell(row,ix.status));
        const mlbam=num(cell(row,ix.mlbam));
        const normalized=norm(name);
        const existing=playerMatch(maps,{mlbam_id:mlbam,normalized_name:normalized,name});
        if(existing)updated++;else inserted++;
        playerRows.push(cleanObject({league_id:leagueId,mlbam_id:mlbam,name,normalized_name:normalized,age:num(cell(row,ix.age)),positions:splitPositions(cell(row,ix.pos)),mlb_team:cell(row,ix.org),owner_team_id:maps.teams.get(norm(owner))?.id,roster_status:owner,is_minor_leaguer:/minor|milb|prospect/i.test(cell(row,ix.minor)||cell(row,ix.status)),is_free_agent:owner==="FREE AGENT"}));
      });
      const saved=await cloudStore.upsertRows("players",playerRows,"league_id,normalized_name");
      saved.forEach(p=>{maps.playersByName.set(norm(p.normalized_name||p.name),p);if(p.mlbam_id)maps.playersByMlbam.set(String(p.mlbam_id),p)});
      processed+=batch.length;matched+=saved.length;
      await updateJob(job,{rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched});
      progress(ctx,"Fantrax player/roster import",{processed,total:rows.length,inserted,updated,duplicate,unmatched,batch:Math.ceil(processed/BATCH_SIZE),message:`Fantrax players ${processed} / ${rows.length}`});
      await sleep();
    }
    await updateJob(job,{status:"completed",rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched,completed_at:now()});
    return{processed,matched,inserted,updated,duplicate,unmatched};
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
    const ix={name:map.find(["name","player","player name"]),mlbam:map.find(["player_id","mlbam","mlbam id","mlb id"]),value:map.find(["hkb value","value","dynasty value"]),overall:map.find(["overall rank","rank","overall"]),posRank:map.find(["position rank","pos rank"])};
    let processed=0,matched=0,unmatched=0,updated=0;
    for(const batch of chunk(rows)){
      ensureNotCancelled(ctx);
      const updates=[];
      batch.forEach(row=>{
        const name=cell(row,ix.name),mlbam=num(cell(row,ix.mlbam)),existing=playerMatch(maps,{mlbam_id:mlbam,normalized_name:norm(name),name});
        if(!existing){unmatched++;return}
        matched++;updated++;
        updates.push(cleanObject({id:existing.id,league_id:leagueId,name:existing.name,normalized_name:existing.normalized_name,hkb_value:num(cell(row,ix.value)),overall_rank:num(cell(row,ix.overall)),position_rank:num(cell(row,ix.posRank))}));
      });
      await cloudStore.upsertRows("players",updates,"id");
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
        const playerId=num(cell(row,playerIx)),name=statcastName(row,map),existing=playerMatch(maps,{mlbam_id:playerId,normalized_name:norm(name),name});
        if(!existing){unmatched++;return}
        const metrics={};
        metricKeys.forEach(key=>{const ix=map.find(key);if(ix>=0&&cell(row,ix)!=="")metrics[key]=num(cell(row,ix))??cell(row,ix)});
        if(!Object.keys(metrics).length){unmatched++;return}
        matched++;updated++;
        metricRows.push({league_id:leagueId,player_id:existing.id,source:"Statcast",season:num(cell(row,seasonIx)),metric_type:type,metrics,imported_at:now()});
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
async function importTrades({leagueId,file,onProgress,cancelled}){
  const ctx={leagueId,onProgress,cancelled,startedAt:Date.now()};
  const job=await createJob(leagueId,"Fantrax trade history",file);
  try{
    const rows=await parseCsv(file),head=rows.shift()||[],map=headerMap(head),maps=await cloudMaps(leagueId);
    const ix={date:map.find(["date","transaction date","processed","timestamp"]),type:map.find(["transaction type","type","action","transaction"]),to:map.find(["to","to team","receiving team","team/manager receiving players","new team","team"]),from:map.find(["from","from team","sending team","team/manager sending players","old team"]),player:map.find(["player","players","player name","asset","name"]),notes:map.find(["notes","details","description","transaction details"]),id:map.find(["transaction id","transaction #","id","trade id"])};
    let processed=0,matched=0,unmatched=0,inserted=0;
    for(const row of rows){
      ensureNotCancelled(ctx);
      const to=cleanOwner(cell(row,ix.to)),from=cleanOwner(cell(row,ix.from));
      await ensureTeams(leagueId,[to,from],maps);
      const trade=(await cloudStore.insertRows("trades",[cleanObject({league_id:leagueId,transaction_date:cell(row,ix.date).slice(0,10),team_a_id:maps.teams.get(norm(to))?.id,team_b_id:maps.teams.get(norm(from))?.id,trade_type:cell(row,ix.type)||"Trade",notes:cell(row,ix.notes),source:"Fantrax CSV",external_transaction_id:cell(row,ix.id)})]))[0];
      for(const playerName of splitPlayers(cell(row,ix.player)||cell(row,ix.notes))){
        const player=maps.playersByName.get(norm(playerName));
        if(player)matched++;else unmatched++;
        await cloudStore.insertRows("trade_assets",[cleanObject({league_id:leagueId,trade_id:trade.id,player_id:player?.id,player_name:playerName,from_team_id:maps.teams.get(norm(from))?.id,to_team_id:maps.teams.get(norm(to))?.id,asset_type:"player"})]);
      }
      processed++;inserted++;
      if(processed%BATCH_SIZE===0){await updateJob(job,{rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched});progress(ctx,"Fantrax trade-history import",{processed,total:rows.length,inserted,unmatched,message:`Trades ${processed} / ${rows.length}`});await sleep()}
    }
    await updateJob(job,{status:"completed",rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched,completed_at:now()});
    progress(ctx,"Fantrax trade-history import",{processed,total:rows.length,inserted,unmatched,message:`Trades ${processed} / ${rows.length}`});
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
async function verify({leagueId,onProgress}){
  const counts=await cloudStore.getLeagueCounts(leagueId);
  const [players,metrics,trades,assets]=await Promise.all([cloudStore.getPlayers(leagueId),cloudStore.selectRows("player_metrics",leagueId),cloudStore.getTrades(leagueId),cloudStore.selectRows("trade_assets",leagueId)]);
  const playerIds=new Set(players.map(p=>p.id)),tradeIds=new Set(trades.map(t=>t.id));
  const checks=[
    {name:"Cloud players exist",status:counts.players>0?"PASS":"FAIL",detail:`${counts.players} players`},
    {name:"HKB values loaded",status:players.some(p=>p.hkb_value!==null&&p.hkb_value!==undefined)?"PASS":"WARNING",detail:"At least one player has HKB value"},
    {name:"Metrics reference valid players",status:metrics.every(m=>playerIds.has(m.player_id))?"PASS":"FAIL",detail:`${counts.player_metrics} metrics`},
    {name:"Trade assets reference trades",status:assets.every(a=>tradeIds.has(a.trade_id))?"PASS":"FAIL",detail:`${counts.trade_assets} assets`}
  ];
  const passed=checks.every(c=>c.status!=="FAIL");
  onProgress?.({stage:"Verification",checks,counts,passed,message:passed?"Verification passed":"Verification needs review"});
  return{checks,counts,passed};
}
export async function runStep({step,leagueId,file,onProgress,cancelled=()=>false}){
  if(!leagueId&&step!=="verification")throw new Error("Select or create a cloud league first.");
  const args={leagueId,file,onProgress,cancelled};
  if(step==="fantrax")return importFantrax(args);
  if(step==="hkb")return importHkb(args);
  if(step==="statcastHitters")return importStatcast({...args,type:"hitter"});
  if(step==="statcastPitchers")return importStatcast({...args,type:"pitcher"});
  if(step==="trades")return importTrades(args);
  if(step==="custom")return migrateCustom(args);
  if(step==="verification")return verify(args);
  throw new Error(`Unknown cloud import step: ${step}`);
}
