import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabase.js";

const hasConfig=Boolean(
  SUPABASE_URL&&
  SUPABASE_ANON_KEY&&
  !String(SUPABASE_URL).includes("YOUR_")&&
  !String(SUPABASE_ANON_KEY).includes("YOUR_")
);

export const supabaseStatus={
  available:hasConfig,
  initialized:false,
  provider:"Supabase",
  mode:hasConfig?"ready":"local-only",
  message:hasConfig?"Supabase client ready":"Supabase configuration unavailable. Running in local-only mode."
};

export const supabase=hasConfig?createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true
  }
}):null;

supabaseStatus.initialized=Boolean(supabase);

export default supabase;
