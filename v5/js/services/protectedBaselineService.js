import { readProtectedBaselineDomains } from "../repositories/protectedBaselineRepository.js";

export const PROTECTED_BASELINE_PROFILES=Object.freeze({
  STRICT:Object.freeze({
    id:"STRICT",version:"1",
    allowedChanges:Object.freeze({players:Object.freeze([]),scores:Object.freeze([]),metrics:Object.freeze([]),teams:Object.freeze([]),managers:Object.freeze([])})
  }),
  MLBAM_BACKFILL:Object.freeze({
    id:"MLBAM_BACKFILL",version:"1",
    allowedChanges:Object.freeze({players:Object.freeze(["mlbam_id","updated_at"]),scores:Object.freeze([]),metrics:Object.freeze([]),teams:Object.freeze([]),managers:Object.freeze([])})
  })
});

const encoder=new TextEncoder();
function normalize(value){
  if(value===undefined||value===null)return null;
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));
  if(typeof value==="number"&&!Number.isFinite(value))return null;
  return value;
}
function omitFields(row,allowed=[]){
  const omitted=new Set(allowed);
  return Object.fromEntries(Object.entries(row||{}).filter(([key])=>!omitted.has(key)));
}
export function canonicalProtectedRows(rows=[],allowed=[]){
  return (rows||[]).map(row=>normalize(omitFields(row,allowed))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export async function protectedDigest(value,{cryptoImpl=globalThis.crypto}={}){
  if(!cryptoImpl?.subtle)throw new Error("SHA-256 is unavailable in this runtime.");
  const bytes=await cryptoImpl.subtle.digest("SHA-256",encoder.encode(JSON.stringify(normalize(value))));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
function immutable(value){
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.values(value).forEach(immutable);Object.freeze(value)}
  return value;
}
function failureStatus(error){
  const text=String(error?.message||error||"").toLowerCase();
  if(error?.code==="PERMISSION_BLOCKED"||/permission|not authorized|row.level.security|sign in|jwt/.test(text))return "PERMISSION_BLOCKED";
  if(/unavailable|not initialized|network|fetch/.test(text))return "UNAVAILABLE";
  return "QUERY_FAILED";
}
export async function captureProtectedBaseline({leagueId,profile="MLBAM_BACKFILL",dependencies={}}={}){
  const contract=typeof profile==="string"?PROTECTED_BASELINE_PROFILES[profile]:profile;
  if(!contract?.id||!contract?.allowedChanges)throw new Error("A supported protected baseline profile is required.");
  const read=dependencies.readProtectedBaselineDomains||readProtectedBaselineDomains;
  try{
    const rows=await read(leagueId,{dependencies:dependencies.repository});
    const capturedAt=new Date().toISOString(),domains={};
    for(const name of ["players","scores","metrics","teams","managers"]){
      const canonical=canonicalProtectedRows(rows[name]||[],contract.allowedChanges[name]||[]);
      domains[name]=Object.freeze({domain:name.toUpperCase(),status:"AVAILABLE",count:(rows[name]||[]).length,hash:await protectedDigest(canonical,{cryptoImpl:dependencies.cryptoImpl}),capturedAt,profile:contract.id,contractVersion:contract.version});
    }
    return immutable({status:"AVAILABLE",leagueId,profile:contract.id,contractVersion:contract.version,capturedAt,allowedChanges:contract.allowedChanges,domains,errors:[],warnings:[]});
  }catch(error){
    const status=failureStatus(error);
    return immutable({status,leagueId,profile:contract.id,contractVersion:contract.version,capturedAt:new Date().toISOString(),allowedChanges:contract.allowedChanges,domains:{},errors:[String(error?.message||error)],warnings:[]});
  }
}
export function compareProtectedBaselines(before,after){
  if(before?.status!=="AVAILABLE")return immutable({status:before?.status||"UNAVAILABLE",domains:{},errors:before?.errors||["Before baseline is unavailable."]});
  if(after?.status!=="AVAILABLE")return immutable({status:after?.status||"UNAVAILABLE",domains:{},errors:after?.errors||["After baseline is unavailable."]});
  if(before.leagueId!==after.leagueId||before.profile!==after.profile||before.contractVersion!==after.contractVersion)return immutable({status:"CHANGED",domains:{},errors:["Protected baseline contract or league changed."]});
  const domains={};let changed=false;
  for(const name of Object.keys(before.domains)){const same=before.domains[name]?.count===after.domains[name]?.count&&before.domains[name]?.hash===after.domains[name]?.hash;domains[name]=Object.freeze({status:same?"UNCHANGED":"CHANGED",before:before.domains[name],after:after.domains[name]});if(!same)changed=true}
  return immutable({status:changed?"CHANGED":"UNCHANGED",domains,errors:[]});
}
