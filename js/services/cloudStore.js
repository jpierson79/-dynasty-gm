import { getSupabaseClient, initializeSupabaseClient, withTimeout } from "./supabaseClient.js";

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

export async function updateRow(table,id,patch){
  const supabase=await client();
  const result=await timed(
    supabase.from(table).update(patch).eq("id",id).select("*").single(),
    `${table} update request`
  );
  return requireOk(result,`${table} update request`);
}
