import { getSupabaseClient, initializeSupabaseClient, withTimeout } from "../config/supabaseClient.js";

const REQUEST_TIMEOUT_MS=12000;

export async function client(){
  const supabase=getSupabaseClient()||await initializeSupabaseClient();
  if(!supabase)throw new Error("Supabase client is unavailable.");
  return supabase;
}
export async function request(query,label){
  const result=await withTimeout(query,REQUEST_TIMEOUT_MS,label);
  if(result?.error)throw new Error(`${label}: ${result.error.message}`);
  return result;
}
export async function selectLeagueRows(table,leagueId,{columns="*",order="created_at",ascending=false,filters=[]}={}){
  if(!leagueId)throw new Error("Active league is required.");
  const supabase=await client();
  let query=supabase.from(table).select(columns).eq("league_id",leagueId);
  filters.forEach(filter=>{query=filter(query)});
  if(order)query=query.order(order,{ascending});
  const result=await request(query,`${table} query`);
  return result.data||[];
}
export async function selectAllLeagueRows(table,leagueId,{columns="*",order="created_at",ascending=false,filters=[],pageSize=1000}={}){
  if(!leagueId)throw new Error("Active league is required.");
  const supabase=await client();
  const rows=[];
  for(let from=0;;from+=pageSize){
    let query=supabase.from(table).select(columns).eq("league_id",leagueId);
    filters.forEach(filter=>{query=filter(query)});
    if(order)query=query.order(order,{ascending});
    if(order!=="id")query=query.order("id",{ascending:true});
    query=query.range(from,from+pageSize-1);
    const result=await request(query,`${table} query ${from}-${from+pageSize-1}`);
    const page=result.data||[];
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}
export async function countLeagueRows(table,leagueId,{filters=[]}={}){
  if(!leagueId)throw new Error("Active league is required.");
  const supabase=await client();
  let query=supabase.from(table).select("id",{count:"exact",head:true}).eq("league_id",leagueId);
  filters.forEach(filter=>{query=filter(query)});
  const result=await request(query,`${table} count`);
  return result.count||0;
}
export async function pagedLeagueRows(table,leagueId,{columns="*",page=1,pageSize=50,order="name",ascending=true,filters=[]}={}){
  if(!leagueId)throw new Error("Active league is required.");
  const supabase=await client();
  let query=supabase.from(table).select(columns,{count:"exact"}).eq("league_id",leagueId);
  filters.forEach(filter=>{query=filter(query)});
  query=query.order(order,{ascending});
  if(order!=="id")query=query.order("id",{ascending:true});
  query=query.range((page-1)*pageSize,page*pageSize-1);
  const result=await request(query,`${table} paged query`);
  return {rows:result.data||[],count:result.count||0,page,pageSize};
}
export async function upsertLeagueRows(table,rows,onConflict){
  if(!Array.isArray(rows)||!rows.length)return [];
  const supabase=await client();
  const result=await request(supabase.from(table).upsert(rows,{onConflict}).select("*"),`${table} upsert`);
  return result.data||[];
}
export async function updateLeagueRow(table,id,row){
  const supabase=await client();
  const result=await request(supabase.from(table).update(row).eq("id",id).select("*").single(),`${table} update`);
  return result.data;
}
