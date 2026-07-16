import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabase.js";

const INIT_TIMEOUT_MS=10000;
const LIBRARY_SOURCES=[
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
  "https://esm.sh/@supabase/supabase-js@2"
];

export const supabaseStatus={
  available:false,
  initialized:false,
  provider:"Supabase",
  mode:"local-only",
  message:"Supabase client not initialized.",
  source:""
};

export let supabase=null;

function log(message){
  console.info(`[Supabase] ${message}`);
}

export function withTimeout(promise,ms,label){
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error(`${label} timed out`)),ms);
    })
  ]).finally(()=>clearTimeout(timer));
}

function hasConfig(){
  return Boolean(
    SUPABASE_URL&&
    SUPABASE_ANON_KEY&&
    !String(SUPABASE_URL).includes("YOUR_")&&
    !String(SUPABASE_ANON_KEY).includes("YOUR_")
  );
}

export function supabaseAuthenticatedFetch(input,init={}){
  const headers=new Headers(init.headers||{});
  if(!headers.has("apikey"))headers.set("apikey",SUPABASE_ANON_KEY);
  if(!headers.has("Authorization"))headers.set("Authorization",`Bearer ${SUPABASE_ANON_KEY}`);
  return globalThis.fetch(input,{...init,headers});
}

async function importSupabaseLibrary(onStatus){
  let lastError=null;
  for(const source of LIBRARY_SOURCES){
    try{
      log(`Supabase module import started (${source.includes("jsdelivr")?"jsDelivr":"esm.sh"})`);
      onStatus?.("library-loading",`Library loading (${source.includes("jsdelivr")?"jsDelivr":"esm.sh"})`);
      const module=await withTimeout(import(source),INIT_TIMEOUT_MS,"Supabase library import");
      return { createClient:module.createClient, source };
    }catch(e){
      lastError=e;
      console.warn("[Supabase] library import failed",e?.message||"Unknown import error");
    }
  }
  throw lastError||new Error("Supabase library failed to load");
}

export async function initializeSupabaseClient({onStatus}={}){
  if(supabase){
    supabaseStatus.available=true;
    supabaseStatus.initialized=true;
    return supabase;
  }
  if(!hasConfig()){
    supabaseStatus.available=false;
    supabaseStatus.initialized=false;
    supabaseStatus.mode="local-only";
    supabaseStatus.message="Configuration missing";
    onStatus?.("config-missing","Configuration missing");
    return null;
  }
  log("Configuration loaded");
  const { createClient, source } = await importSupabaseLibrary(onStatus);
  if(typeof createClient!=="function")throw new Error("Supabase library failed to load");
  supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    },
    global:{
      headers:{apikey:SUPABASE_ANON_KEY},
      fetch:supabaseAuthenticatedFetch
    }
  });
  supabaseStatus.available=true;
  supabaseStatus.initialized=true;
  supabaseStatus.mode="ready";
  supabaseStatus.message="Supabase client ready";
  supabaseStatus.source=source;
  log("Client created");
  onStatus?.("client-initialized","Client initialized");
  return supabase;
}

export function getSupabaseClient(){
  return supabase;
}

export default supabase;
