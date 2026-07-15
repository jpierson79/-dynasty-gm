import { getSupabaseClient, initializeSupabaseClient, withTimeout } from "./supabaseClient.js";
import { buildPlayerIdentityIndexes, cleanExternalId, dedupeIdentityRows, resolvePlayerIdentity } from "./playerIdentity.js";

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

function stripPlayerWriteRow(row){
  const out={...(row||{})};
  delete out.id;
  delete out.source;
  delete out.source_player_id;
  delete out.source_row_number;
  delete out.identityResolution;
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
    supabase.from("players").update(stripPlayerWriteRow(row)).eq("id",id).select("*").single(),
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
    const out=stripPlayerWriteRow(row);
    out.id=row.id;
    return out;
  });
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
  const result=await timed(
    supabase.from("leagues").select("*").eq("owner_user_id",user.id).order("created_at",{ascending:true}),
    "Owned leagues request"
  );
  return requireOk(result,"Owned leagues request")||[];
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

async function getRows(table,leagueId){
  const supabase=await client();
  const result=await timed(
    supabase.from(table).select("*").eq("league_id",leagueId),
    `${table} rows request`
  );
  return requireOk(result,`${table} rows request`)||[];
}

export const getPlayers=leagueId=>getRows("players",leagueId);
export const getManagers=leagueId=>getRows("managers",leagueId);
export const getTeams=leagueId=>getRows("teams",leagueId);
export const getTrades=leagueId=>getRows("trades",leagueId);

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
  const supabase=await client();
  const saved=[];
  const meta={inserted:0,updated:0};
  try{
    if(updates.length){
      const result=await timed(
        supabase.from("players").upsert(stripPlayerUpdateRows(updates),{onConflict:"id"}).select("*"),
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
