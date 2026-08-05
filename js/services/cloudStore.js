import { getSupabaseClient, initializeSupabaseClient, withTimeout } from "./supabaseClient.js";
import { buildPlayerIdentityIndexes, cleanExternalId, cleanMlbamId, dedupeIdentityRows, resolvePlayerIdentity } from "./playerIdentity.js";

const REQUEST_TIMEOUT_MS=10000;

async function client(){
  const supabase=getSupabaseClient()||await initializeSupabaseClient();
  if(!supabase)throw new Error("Supabase client is not initialized.");
  return supabase;
}

async function timed(request,label){
  return withTimeout(request,REQUEST_TIMEOUT_MS,label);
}

function requireOk(result,label){
  if(result?.error)throw new Error(`${label}: ${result.error.message}`);
  return result?.data;
}

export function preparePlayerSyncRows(rows){
  const prepared=dedupeIdentityRows(Array.isArray(rows)?rows:[]);
  return {
    ...prepared,
    attempted:prepared.sourceRows,
    afterDeduplication:prepared.rowsAfterDeduplication,
    duplicateKeysRemoved:prepared.duplicateFantraxIds+prepared.duplicateMlbamIds+prepared.duplicateFallbackKeys,
    skippedMissingKeys:prepared.skippedInvalidRows
  };
}

export function serializeMlbamId(value){
  const cleaned=cleanMlbamId(value);
  if(!cleaned)return null;
  if(!/^\d+$/.test(cleaned))return null;
  const numericValue=Number(cleaned);
  if(!Number.isSafeInteger(numericValue)||numericValue<=0)return null;
  return numericValue;
}

function stripPlayerWriteRow(row){
  const out={...(row||{})};
  delete out.id;
  delete out.source;
  delete out.source_player_id;
  delete out.source_row_number;
  delete out.identityResolution;
  delete out.availability_status;
  if("mlbam_id" in out)out.mlbam_id=serializeMlbamId(out.mlbam_id);
  return out;
}

export function stripPlayerUpdateRow(row){
  const out=stripPlayerWriteRow(row);
  if("fantrax_id" in out){
    const fantraxId=cleanExternalId(out.fantrax_id);
    if(fantraxId)out.fantrax_id=fantraxId;
    else delete out.fantrax_id;
  }
  if("mlbam_id" in out&&out.mlbam_id===null)delete out.mlbam_id;
  return out;
}

async function insertPlayer(supabase,row){
  const result=await timed(
    supabase.from("players").insert(stripPlayerWriteRow(row)).select("*").single(),
    "Player insert request"
  );
  if(result?.error)throw new Error(`Player insert request: ${result.error.message}`);
  return result.data;
}

async function updatePlayerById(supabase,id,row){
  const result=await timed(
    supabase.from("players").update(stripPlayerUpdateRow(row)).eq("id",id).select("*").single(),
    "Player update request"
  );
  if(result?.error)throw new Error(`Player update request: ${result.error.message}`);
  return result.data;
}

function stripPlayerInsertRows(rows){
  return rows.map(row=>stripPlayerWriteRow(row));
}

function stripPlayerUpdateRows(rows){
  return rows.map(row=>{
    const out=stripPlayerUpdateRow(row);
    out.id=row.id;
    return out;
  });
}

export function prepareResolvedPlayerUpdateRows(updates,existingRows){
  const existingById=new Map((existingRows||[]).map(row=>[String(row?.id||""),row]));
  return (updates||[]).map(update=>{
    const id=String(update?.id||"").trim();
    const existing=existingById.get(id);
    if(!id||!existing)throw new Error(`Resolved update player was not found or is not accessible: ${id||"missing UUID"}`);
    if(update.league_id&&String(update.league_id)!==String(existing.league_id)){
      throw new Error(`Resolved update league mismatch for player ${id}`);
    }
    if(!existing.name||!existing.normalized_name){
      throw new Error(`Resolved update player is missing required identity fields: ${id}`);
    }
    const prepared=stripPlayerUpdateRow({
      ...update,
      league_id:existing.league_id,
      name:existing.name,
      normalized_name:existing.normalized_name
    });
    prepared.id=id;
    return prepared;
  });
}

function duplicateIds(rows){
  const seen=new Set(),duplicates=new Set();
  rows.forEach(row=>{
    const id=String(row?.id||"").trim();
    if(!id)return;
    if(seen.has(id))duplicates.add(id);
    seen.add(id);
  });
  return [...duplicates].sort();
}

export async function getCurrentUser(){
  const supabase=await client();
  const result=await timed(supabase.auth.getUser(),"Current user request");
  if(result.error)throw new Error(result.error.message);
  return result.data.user||null;
}

export async function getOwnedLeagues(){
  const supabase=await client();
  const user=await getCurrentUser();
  if(!user)return [];
  const owned=await timed(
    supabase.from("leagues").select("*").eq("owner_user_id",user.id).order("created_at",{ascending:true}),
    "Owned leagues request"
  );
  const ownedRows=requireOk(owned,"Owned leagues request")||[];
  const membership=await timed(
    supabase.from("league_members").select("league_id").eq("user_id",user.id),
    "League membership request"
  );
  const memberRows=requireOk(membership,"League membership request")||[];
  const sharedIds=[...new Set(memberRows.map(row=>row.league_id).filter(Boolean).filter(id=>!ownedRows.some(league=>league.id===id)))];
  if(!sharedIds.length)return ownedRows;
  const shared=await timed(
    supabase.from("leagues").select("*").in("id",sharedIds).order("created_at",{ascending:true}),
    "Shared leagues request"
  );
  const sharedRows=requireOk(shared,"Shared leagues request")||[];
  return [...ownedRows,...sharedRows].sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||"")));
}

export async function getLeague(leagueId){
  const supabase=await client();
  const result=await timed(
    supabase.from("leagues").select("*").eq("id",leagueId).maybeSingle(),
    "League request"
  );
  if(result.error)throw new Error(result.error.message);
  return result.data||null;
}

export async function createLeague(input){
  const supabase=await client();
  const user=await getCurrentUser();
  if(!user)throw new Error("Sign in before creating a cloud league.");
  const name=String(input?.name||"").trim();
  if(!name)throw new Error("League name is required.");
  const existing=await timed(
    supabase.from("leagues").select("*").eq("owner_user_id",user.id).eq("name",name).maybeSingle(),
    "Duplicate league check"
  );
  if(existing.error)throw new Error(existing.error.message);
  if(existing.data)return { league:existing.data, duplicate:true, user };
  const payload={
    owner_user_id:user.id,
    name,
    platform:input.platform||"Fantrax",
    format:input.format||"Dynasty",
    team_count:Number(input.teamCount)||10,
    scoring_type:input.scoringType||"Head-to-Head Points",
    settings:input.settings||{}
  };
  const result=await timed(
    supabase.from("leagues").insert(payload).select("*").single(),
    "Create league request"
  );
  return { league:requireOk(result,"Create league request"), duplicate:false, user };
}

export async function getLeagueMemberships(leagueId){
  const supabase=await client();
  const result=await timed(
    supabase.from("league_members").select("*").eq("league_id",leagueId),
    "League memberships request"
  );
  return requireOk(result,"League memberships request")||[];
}

export async function createOwnerMembership(leagueId,userId){
  const supabase=await client();
  const existing=await timed(
    supabase.from("league_members").select("*").eq("league_id",leagueId).eq("user_id",userId).maybeSingle(),
    "Owner membership check"
  );
  if(existing.error)throw new Error(existing.error.message);
  if(existing.data)return existing.data;
  const result=await timed(
    supabase.from("league_members").insert({league_id:leagueId,user_id:userId,role:"owner"}).select("*").single(),
    "Create owner membership request"
  );
  return requireOk(result,"Create owner membership request");
}

async function countRows(table,leagueId){
  const supabase=await client();
  const result=await timed(
    supabase.from(table).select("id",{count:"exact",head:true}).eq("league_id",leagueId),
    `${table} count request`
  );
  if(result.error)throw new Error(result.error.message);
  return result.count||0;
}

export async function getLeagueCounts(leagueId){
  const tables=["managers","teams","players","player_metrics","calculated_player_scores","manager_preferences","trades","trade_assets","player_snapshots","import_jobs"];
  const entries=await Promise.all(tables.map(async table=>[table,await countRows(table,leagueId)]));
  return Object.fromEntries(entries);
}

const RESET_TABLE_ORDER=["calculated_player_scores","player_metrics","player_snapshots","manager_preferences","trade_assets","trades","players","teams","managers","import_jobs"];
const RESET_GROUPS={
  players:["calculated_player_scores","player_metrics","player_snapshots","players"],
  trades:["trade_assets","trades"],
  teams:["teams"],
  managers:["manager_preferences","managers"],
  importJobs:["import_jobs"]
};

function resetTablesFromOptions(options={}){
  const selected=new Set();
  Object.entries(RESET_GROUPS).forEach(([key,tables])=>{
    if(options[key]!==false)tables.forEach(table=>selected.add(table));
  });
  return RESET_TABLE_ORDER.filter(table=>selected.has(table));
}

async function requireLeagueOwner(leagueId){
  const [user,league]=await Promise.all([getCurrentUser(),getLeague(leagueId)]);
  if(!user)throw new Error("Sign in before resetting cloud data.");
  if(!league)throw new Error("Selected cloud league was not found.");
  if(league.owner_user_id!==user.id)throw new Error("Only the cloud league owner can reset imported data.");
  return {user,league};
}

export async function previewImportedDataReset(leagueId,{options={}}={}){
  const {league}=await requireLeagueOwner(leagueId);
  const tables=resetTablesFromOptions(options);
  const counts=Object.fromEntries(await Promise.all(tables.map(async table=>[table,await countRows(table,leagueId)])));
  return {league,tables,counts,dryRun:true};
}

export async function resetImportedCloudData(leagueId,{options={},confirmationName=""}={}){
  const {league}=await requireLeagueOwner(leagueId);
  if(String(confirmationName||"").trim()!==String(league.name||"").trim())throw new Error("Typed confirmation does not match the selected cloud league name.");
  const tables=resetTablesFromOptions(options);
  const supabase=await client();
  const before=Object.fromEntries(await Promise.all(tables.map(async table=>[table,await countRows(table,leagueId)])));
  const deleted={};
  for(const table of tables){
    const result=await timed(
      supabase.from(table).delete().eq("league_id",leagueId).select("id"),
      `${table} reset delete request`
    );
    const rows=requireOk(result,`${table} reset delete request`)||[];
    deleted[table]=rows.length;
  }
  const after=Object.fromEntries(await Promise.all(tables.map(async table=>[table,await countRows(table,leagueId)])));
  return {league,tables,before,deleted,after,passed:tables.every(table=>after[table]===0)};
}

async function getRows(table,leagueId){
  const supabase=await client();
  const result=await timed(
    supabase.from(table).select("*").eq("league_id",leagueId),
    `${table} rows request`
  );
  return requireOk(result,`${table} rows request`)||[];
}

export async function getPlayers(leagueId,{pageSize=1000,supabaseClient=null}={}){
  const supabase=supabaseClient||await client();
  const rows=[];
  for(let from=0;;from+=pageSize){
    const to=from+pageSize-1;
    const result=await timed(
      supabase
        .from("players")
        .select("*")
        .eq("league_id",leagueId)
        .order("id",{ascending:true})
        .range(from,to),
      `players rows request ${from}-${to}`
    );
    if(result?.error)throw new Error(`Player preload failed at range ${from}-${to}: ${result.error.message}`);
    const page=Array.isArray(result?.data)?result.data:[];
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}
export const getManagers=leagueId=>getRows("managers",leagueId);
export const getTeams=leagueId=>getRows("teams",leagueId);
export const getTrades=leagueId=>getRows("trades",leagueId);

function boolFilter(query,column,value){
  if(value==="yes")return query.not(column,"is",null);
  if(value==="no")return query.is(column,null);
  return query;
}

function statusText(value){
  return String(value||"").trim();
}

function isFreeAgentStatus(value){
  return ["free agent","fa","waivers","available","none","n/a","-","--"].includes(statusText(value).toLowerCase());
}

function conflictReason(player,resolvedTeamName){
  const roster=statusText(player.roster_status);
  if(isFreeAgentStatus(roster)&&player.owner_team_id)return"Status says FREE AGENT but owner_team_id is populated";
  if(player.is_free_agent&&player.owner_team_id&&resolvedTeamName&&roster&&roster.toLowerCase()===resolvedTeamName.toLowerCase())return"Rostered player incorrectly classified as free agent";
  if(player.is_free_agent&&player.owner_team_id&&roster&&!isFreeAgentStatus(roster))return"Status mapping inconsistency";
  if(player.is_free_agent&&player.owner_team_id)return"Possible stale ownership assignment";
  return"Unknown/unrecognized Fantrax status";
}

function classifyDuplicateGroup(players){
  const fantraxIds=[...new Set(players.map(p=>String(p.fantrax_id||"").trim()).filter(Boolean))];
  const mlbamIds=[...new Set(players.map(p=>String(p.mlbam_id||"").trim()).filter(Boolean))];
  const authCount=players.filter(p=>p.fantrax_id||p.mlbam_id).length;
  if(fantraxIds.length>1)return"Same normalized name, different Fantrax IDs";
  if(mlbamIds.length>1)return"Same normalized name, different MLBAM IDs";
  if(authCount>0&&authCount<players.length)return"One record has authoritative ID and another does not";
  if(authCount===0)return"Neither record has authoritative ID";
  if(fantraxIds.length===players.length||mlbamIds.length===players.length)return"Likely legitimate different players with the same name";
  return"Potential duplicate requiring manual review";
}

function teamMap(teams){
  return new Map((teams||[]).map(team=>[team.id,team.name||""]));
}

async function latestImportSource(leagueId){
  const supabase=await client();
  const result=await timed(
    supabase.from("import_jobs").select("import_type,file_name,completed_at,started_at").eq("league_id",leagueId).order("completed_at",{ascending:false}).limit(25),
    "Latest import jobs request"
  );
  const rows=requireOk(result,"Latest import jobs request")||[];
  const latest=rows.find(row=>/fantrax|player|roster/i.test(row.import_type||""))||rows[0];
  return latest?[latest.import_type,latest.file_name].filter(Boolean).join(" - "):"";
}

async function allFreeAgentConflicts(leagueId){
  const supabase=await client();
  const rows=[];
  for(let from=0;;from+=1000){
    const result=await timed(
      supabase.from("players").select("*").eq("league_id",leagueId).eq("is_free_agent",true).not("owner_team_id","is",null).order("name",{ascending:true}).range(from,from+999),
      `Free-agent ownership conflicts ${from}-${from+999}`
    );
    const page=requireOk(result,`Free-agent ownership conflicts ${from}-${from+999}`)||[];
    rows.push(...page);
    if(page.length<1000)break;
  }
  return rows;
}

function freeAgentSummary(rows,teamsById){
  const summary={totalConflicts:rows.length,likelyStaleOwnership:0,likelyStatusMappingErrors:0,unknown:0};
  rows.forEach(row=>{
    const reason=conflictReason(row,teamsById.get(row.owner_team_id)||"");
    if(/stale/i.test(reason))summary.likelyStaleOwnership++;
    else if(/mapping|incorrectly classified|status says/i.test(reason))summary.likelyStatusMappingErrors++;
    else summary.unknown++;
  });
  return summary;
}

export async function getFreeAgentOwnershipDiagnostics(leagueId,{page=1,pageSize=100,filters={},search="",exportAll=false}={}){
  const supabase=await client();
  const teams=await getTeams(leagueId);
  const teamsById=teamMap(teams);
  const latestSource=await latestImportSource(leagueId).catch(()=>"");
  const allConflicts=await allFreeAgentConflicts(leagueId);
  let query=supabase.from("players").select("*",{count:"exact"}).eq("league_id",leagueId).eq("is_free_agent",true).not("owner_team_id","is",null).order("name",{ascending:true});
  if(search)query=query.ilike("name",`%${search}%`);
  if(filters.fantraxStatus)query=query.eq("roster_status",filters.fantraxStatus);
  if(filters.rosterStatus)query=query.eq("roster_status",filters.rosterStatus);
  if(filters.fantasyTeam)query=query.eq("owner_team_id",filters.fantasyTeam);
  query=boolFilter(query,"fantrax_id",filters.hasFantraxId);
  query=boolFilter(query,"mlbam_id",filters.hasMlbamId);
  if(!exportAll){
    const from=(Math.max(1,Number(page)||1)-1)*pageSize;
    query=query.range(from,from+pageSize-1);
  }
  const result=await timed(query,"Free-agent ownership diagnostic request");
  const rows=requireOk(result,"Free-agent ownership diagnostic request")||[];
  const decorated=rows.map(player=>({
    ...player,
    position:Array.isArray(player.positions)?player.positions.join("/"):player.positions||"",
    resolved_team_name:teamsById.get(player.owner_team_id)||"",
    latest_import_source:latestSource,
    diagnostic_reason:conflictReason(player,teamsById.get(player.owner_team_id)||"")
  }));
  const statusValues=[...new Set(allConflicts.map(row=>statusText(row.roster_status)).filter(Boolean))].sort();
  const ownerIds=[...new Set(allConflicts.map(row=>row.owner_team_id).filter(Boolean))];
  return {
    kind:"freeAgentOwnership",
    rows:decorated,
    total:exportAll?decorated.length:result.count||0,
    page,
    pageSize,
    summary:freeAgentSummary(allConflicts,teamsById),
    filters:{
      fantraxStatuses:statusValues,
      rosterStatuses:statusValues,
      fantasyTeams:ownerIds.map(id=>({id,name:teamsById.get(id)||id})).sort((a,b)=>a.name.localeCompare(b.name))
    }
  };
}

function duplicateSummary(groups){
  const summary={totalDuplicateNames:groups.length,totalAffectedPlayerRecords:0,groupsWithDistinctAuthoritativeIds:0,groupsMissingAuthoritativeIds:0,potentialTrueDuplicatesRequiringReview:0};
  groups.forEach(group=>{
    summary.totalAffectedPlayerRecords+=group.players.length;
    const classification=group.classification;
    if(/different Fantrax|different MLBAM|legitimate different/i.test(classification))summary.groupsWithDistinctAuthoritativeIds++;
    if(/Neither record/.test(classification))summary.groupsMissingAuthoritativeIds++;
    if(/Potential duplicate|One record/.test(classification))summary.potentialTrueDuplicatesRequiringReview++;
  });
  return summary;
}

export async function getDuplicateNormalizedNameDiagnostics(leagueId,{page=1,pageSize=100,search="",exportAll=false}={}){
  const [players,teams]=await Promise.all([getPlayers(leagueId),getTeams(leagueId)]);
  const teamsById=teamMap(teams);
  const grouped=new Map();
  players.forEach(player=>{
    const key=String(player.normalized_name||"").trim();
    if(!key)return;
    if(search&&!String(player.name||"").toLowerCase().includes(String(search).toLowerCase())&&!key.includes(String(search).toLowerCase()))return;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(player);
  });
  const groups=[...grouped.entries()]
    .filter(([,rows])=>rows.length>1)
    .map(([normalizedName,rows])=>({normalizedName,players:rows.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))),classification:classifyDuplicateGroup(rows)}))
    .sort((a,b)=>b.players.length-a.players.length||a.normalizedName.localeCompare(b.normalizedName));
  const flat=groups.flatMap(group=>group.players.map(player=>({
    ...player,
    normalized_name:group.normalizedName,
    duplicate_group_size:group.players.length,
    duplicate_classification:group.classification,
    position:Array.isArray(player.positions)?player.positions.join("/"):player.positions||"",
    resolved_team_name:teamsById.get(player.owner_team_id)||""
  })));
  const currentPage=Math.max(1,Number(page)||1);
  const rows=exportAll?flat:flat.slice((currentPage-1)*pageSize,currentPage*pageSize);
  return {
    kind:"duplicateNormalizedNames",
    rows,
    total:flat.length,
    page:currentPage,
    pageSize,
    summary:duplicateSummary(groups)
  };
}

export async function selectRows(table,leagueId){
  return getRows(table,leagueId);
}

export async function insertRows(table,rows){
  if(!rows.length)return [];
  const supabase=await client();
  const result=await timed(
    supabase.from(table).insert(rows).select("*"),
    `${table} insert request`
  );
  return requireOk(result,`${table} insert request`)||[];
}

export async function upsertRows(table,rows,onConflict){
  if(!rows.length)return [];
  const supabase=await client();
  const result=await timed(
    supabase.from(table).upsert(rows,{onConflict}).select("*"),
    `${table} upsert request`
  );
  return requireOk(result,`${table} upsert request`)||[];
}

export async function syncPlayers(rows,{label="Player import"}={}){
  const prepared=preparePlayerSyncRows(rows);
  const meta={
    ...prepared,
    inserted:0,
    updated:0,
    matchedByFantrax:0,
    matchedByMlbam:0,
    matchedByFallback:0,
    unmatched:0,
    identityConflicts:[],
    skippedInvalidRows:prepared.skippedInvalidRows||[]
  };
  if(!prepared.rows.length)return {data:[],meta};
  const supabase=await client();
  const saved=[];
  try{
    const leagueIds=[...new Set(prepared.rows.map(row=>row.league_id).filter(Boolean))];
    const existingRows=[];
    for(const leagueId of leagueIds){
      const result=await timed(
        supabase.from("players").select("*").eq("league_id",leagueId),
        "Existing player identity load"
      );
      existingRows.push(...(requireOk(result,"Existing player identity load")||[]));
    }
    const indexes=buildPlayerIdentityIndexes(existingRows);
    for(const row of prepared.rows){
      const fantraxId=cleanExternalId(row.fantrax_id);
      const resolved=row.id
        ?{status:"matched",player:{id:row.id},matchType:"uuid"}
        :resolvePlayerIdentity(row,indexes,{leagueId:row.league_id,rowNumber:(row.source_row_number||0)});
      if(resolved.status==="conflict"){
        meta.identityConflicts.push(resolved.conflict);
        continue;
      }
      if(resolved.status==="matched"&&resolved.player?.id){
        const updatedPlayer=await updatePlayerById(supabase,resolved.player.id,row);
        saved.push(updatedPlayer);
        meta.updated++;
        if(resolved.matchType==="fantrax")meta.matchedByFantrax++;
        else if(resolved.matchType==="mlbam")meta.matchedByMlbam++;
        else if(resolved.matchType==="fallback")meta.matchedByFallback++;
        continue;
      }
      if(!fantraxId){
        meta.unmatched++;
        console.warn("[Cloud Store] skipped unmatched player without stable Fantrax ID",{name:row.name||"",league_id:row.league_id||"",mlbam_id:row.mlbam_id||""});
        continue;
      }
      const insertedPlayer=await insertPlayer(supabase,{...row,fantrax_id:fantraxId});
      saved.push(insertedPlayer);
      meta.inserted++;
    }
  }catch(databaseError){
    const error=new Error(`${label} failed

Rows attempted: ${meta.sourceRows}
Rows after deduplication: ${meta.rowsAfterDeduplication}
Duplicate Fantrax IDs removed: ${meta.duplicateFantraxIds}
Duplicate MLBAM IDs removed: ${meta.duplicateMlbamIds}
Duplicate fallback keys removed: ${meta.duplicateFallbackKeys}
Rows skipped invalid: ${meta.skippedInvalidRows.length}
Identity conflicts: ${meta.identityConflicts.length}

Database error:
${databaseError.message}`);
    error.meta=meta;
    error.databaseError=databaseError;
    throw error;
  }
  return {data:saved,meta};
}

export async function syncResolvedPlayers({updates=[],inserts=[]},{label="Resolved player import"}={}){
  const duplicateUpdateIds=duplicateIds(updates);
  if(duplicateUpdateIds.length){
    throw new Error(`Resolved update batch contains duplicate player IDs: ${duplicateUpdateIds.join(", ")}`);
  }
  const supabase=await client();
  const saved=[];
  const meta={inserted:0,updated:0};
  try{
    if(updates.length){
      const updateIds=updates.map(row=>String(row?.id||"").trim()).filter(Boolean);
      const existingResult=await timed(
        supabase.from("players").select("id,league_id,name,normalized_name").in("id",updateIds),
        "Resolved player update identity load"
      );
      const existingRows=requireOk(existingResult,"Resolved player update identity load")||[];
      const preparedUpdates=prepareResolvedPlayerUpdateRows(updates,existingRows);
      const result=await timed(
        supabase.from("players").upsert(preparedUpdates,{onConflict:"id"}).select("*"),
        "Resolved player update batch request"
      );
      const rows=requireOk(result,"Resolved player update batch request")||[];
      saved.push(...rows);
      meta.updated=rows.length;
    }
    if(inserts.length){
      const result=await timed(
        supabase.from("players").insert(stripPlayerInsertRows(inserts)).select("*"),
        "Resolved player insert batch request"
      );
      const rows=requireOk(result,"Resolved player insert batch request")||[];
      saved.push(...rows);
      meta.inserted=rows.length;
    }
  }catch(databaseError){
    const error=new Error(`${label} failed

Rows to update: ${updates.length}
Rows to insert: ${inserts.length}

Database error:
${databaseError.message}`);
    error.databaseError=databaseError;
    error.meta=meta;
    throw error;
  }
  return {data:saved,meta};
}

export async function updateRow(table,id,patch){
  const supabase=await client();
  const result=await timed(
    supabase.from(table).update(patch).eq("id",id).select("*").single(),
    `${table} update request`
  );
  return requireOk(result,`${table} update request`);
}

export async function updateLeagueSettings(leagueId,settingsPatch){
  const league=await getLeague(leagueId);
  if(!league)throw new Error("Cloud league not found.");
  const settings={...(league.settings||{}),...(settingsPatch||{})};
  const supabase=await client();
  const result=await timed(
    supabase.from("leagues").update({settings}).eq("id",leagueId).select("*").single(),
    "League settings update request"
  );
  return requireOk(result,"League settings update request");
}
