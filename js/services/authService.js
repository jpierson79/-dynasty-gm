import { getSupabaseClient, initializeSupabaseClient, supabaseStatus, withTimeout } from "./supabaseClient.js";

const SESSION_TIMEOUT_MS=10000;

async function requireClient(){
  const client=getSupabaseClient()||await initializeSupabaseClient();
  if(!client)throw new Error(supabaseStatus.message||"Supabase unavailable. Running in local-only mode.");
  return client;
}

export async function initializeAuthClient(options){
  return initializeSupabaseClient(options);
}

export async function signUp(email,password,displayName){
  const client=await requireClient();
  return client.auth.signUp({
    email,
    password,
    options:{data:{display_name:displayName||""}}
  });
}

export async function signIn(email,password){
  return (await requireClient()).auth.signInWithPassword({email,password});
}

export async function signOut(){
  return (await requireClient()).auth.signOut();
}

export async function getCurrentSession(){
  console.info("[Supabase] Session request started");
  try{
    const { data, error } = await withTimeout((await requireClient()).auth.getSession(),SESSION_TIMEOUT_MS,"Session request");
    if(error)throw error;
    console.info("[Supabase] Session request completed");
    return data.session||null;
  }catch(e){
    if(/timed out/i.test(e?.message||""))console.warn("[Supabase] Session request timed out");
    else console.warn("[Supabase] Session request failed",e?.message||"Unknown session error");
    throw e;
  }
}

export async function getCurrentUser(){
  const { data, error } = await withTimeout((await requireClient()).auth.getUser(),SESSION_TIMEOUT_MS,"User request");
  if(error)throw error;
  return data.user||null;
}

export function subscribeToAuthChanges(callback){
  const client=getSupabaseClient();
  if(!client)return { data:{ subscription:{ unsubscribe(){} } } };
  return client.auth.onAuthStateChange((event,session)=>{
    callback(event,session);
  });
}

export async function getCurrentProfile(){
  const user=await getCurrentUser();
  if(!user)return null;
  const { data, error } = await withTimeout(
    (await requireClient()).from("profiles").select("*").eq("id",user.id).maybeSingle(),
    SESSION_TIMEOUT_MS,
    "Profile request"
  );
  if(error)throw error;
  return data||{
    id:user.id,
    email:user.email||"",
    display_name:user.user_metadata?.display_name||""
  };
}

export { supabaseStatus };
