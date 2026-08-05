import { client, request } from "./baseRepository.js";

export async function currentUser(){
  const supabase=await client();
  const result=await request(supabase.auth.getUser(),"Current user");
  return result.data.user||null;
}
export async function accessibleLeagues(userId){
  if(!userId)return [];
  const supabase=await client();
  const owned=await request(supabase.from("leagues").select("*").eq("owner_user_id",userId).order("created_at",{ascending:true}),"Owned leagues");
  const memberships=await request(supabase.from("league_members").select("league_id").eq("user_id",userId),"League memberships");
  const ownedRows=owned.data||[];
  const ownedIds=new Set(ownedRows.map(league=>league.id));
  const sharedIds=[...new Set((memberships.data||[]).map(row=>row.league_id).filter(Boolean).filter(id=>!ownedIds.has(id)))];
  if(!sharedIds.length)return ownedRows;
  const shared=await request(supabase.from("leagues").select("*").in("id",sharedIds).order("created_at",{ascending:true}),"Shared leagues");
  return [...ownedRows,...(shared.data||[])].sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||"")));
}
export async function leagueById(leagueId){
  const supabase=await client();
  const result=await request(supabase.from("leagues").select("*").eq("id",leagueId).single(),"League lookup");
  return result.data||null;
}
export async function memberships(leagueId){
  const supabase=await client();
  const result=await request(supabase.from("league_members").select("*").eq("league_id",leagueId),"League membership check");
  return result.data||[];
}
export async function saveFantraxSeasonContext(leagueId,settingsPatch){
  if(!leagueId)throw new Error("Active league is required.");
  const supabase=await client();
  const current=await request(supabase.from("leagues").select("id,settings").eq("id",leagueId).single(),"Fantrax season settings lookup");
  const settings={...(current.data?.settings||{}),...(settingsPatch||{})};
  const result=await request(supabase.from("leagues").update({settings}).eq("id",leagueId).select("*").single(),"Fantrax season settings update");
  return result.data;
}
