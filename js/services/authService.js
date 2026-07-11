import { supabase, supabaseStatus } from "./supabaseClient.js";

function requireClient(){
  if(!supabase)throw new Error(supabaseStatus.message||"Supabase unavailable. Running in local-only mode.");
  return supabase;
}

export async function signUp(email,password,displayName){
  const client=requireClient();
  return client.auth.signUp({
    email,
    password,
    options:{data:{display_name:displayName||""}}
  });
}

export async function signIn(email,password){
  return requireClient().auth.signInWithPassword({email,password});
}

export async function signOut(){
  return requireClient().auth.signOut();
}

export async function getCurrentSession(){
  const { data, error } = await requireClient().auth.getSession();
  if(error)throw error;
  return data.session||null;
}

export async function getCurrentUser(){
  const { data, error } = await requireClient().auth.getUser();
  if(error)throw error;
  return data.user||null;
}

export function subscribeToAuthChanges(callback){
  return requireClient().auth.onAuthStateChange((event,session)=>{
    callback(event,session);
  });
}

export async function getCurrentProfile(){
  const user=await getCurrentUser();
  if(!user)return null;
  const { data, error } = await requireClient()
    .from("profiles")
    .select("*")
    .eq("id",user.id)
    .maybeSingle();
  if(error)throw error;
  return data||{
    id:user.id,
    email:user.email||"",
    display_name:user.user_metadata?.display_name||""
  };
}

export { supabaseStatus };
