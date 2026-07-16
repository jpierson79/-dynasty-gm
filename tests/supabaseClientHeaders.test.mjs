import assert from "node:assert/strict";
import { SUPABASE_ANON_KEY } from "../js/config/supabase.js";
import { supabaseAuthenticatedFetch } from "../js/services/supabaseClient.js";

const calls=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
  calls.push({input,init});
  return Promise.resolve({ok:true});
};

await supabaseAuthenticatedFetch("https://example.supabase.co/rest/v1/players",{headers:{}});
let headers=new Headers(calls.at(-1).init.headers);
assert.equal(headers.get("apikey"),SUPABASE_ANON_KEY);
assert.equal(headers.get("Authorization"),`Bearer ${SUPABASE_ANON_KEY}`);

await supabaseAuthenticatedFetch("https://example.supabase.co/rest/v1/players",{
  headers:{Authorization:"Bearer signed-in-user-token"}
});
headers=new Headers(calls.at(-1).init.headers);
assert.equal(headers.get("apikey"),SUPABASE_ANON_KEY);
assert.equal(headers.get("Authorization"),"Bearer signed-in-user-token");

globalThis.fetch=originalFetch;

console.log("supabaseClientHeaders tests passed");
