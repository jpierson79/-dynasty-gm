import { readProtectedBaselineDomains } from "../repositories/protectedBaselineRepository.js";

export const PROTECTED_BASELINE_PROFILES=Object.freeze({
  STRICT:Object.freeze({
    id:"STRICT",version:"1",
    allowedChanges:Object.freeze({players:Object.freeze([]),scores:Object.freeze([]),metrics:Object.freeze([]),teams:Object.freeze([]),managers:Object.freeze([])})
  }),
  MLBAM_BACKFILL:Object.freeze({
    id:"MLBAM_BACKFILL",version:"1",
    allowedChanges:Object.freeze({players:Object.freeze(["mlbam_id","updated_at"]),scores:Object.freeze([]),metrics:Object.freeze([]),teams:Object.freeze([]),managers:Object.freeze([])})
  }),
  STATCAST_REFRESH:Object.freeze({
    id:"STATCAST_REFRESH",version:"1",
    allowedChanges:Object.freeze({players:Object.freeze([]),scores:Object.freeze([]),metrics:Object.freeze([]),teams:Object.freeze([]),managers:Object.freeze([])}),
    domainPartitions:Object.freeze({metrics:Object.freeze([
      Object.freeze({name:"metrics",label:"NON-STATCAST METRICS",filter:Object.freeze({field:"source",equals:"Statcast",negate:true}),expectedMutable:false}),
      Object.freeze({name:"statcastMetrics",label:"STATCAST METRICS",filter:Object.freeze({field:"source",equals:"Statcast"}),expectedMutable:true})
    ])})
  }),
  FANTRAX_PRODUCTION_IMPORT:Object.freeze({
    id:"FANTRAX_PRODUCTION_IMPORT",version:"1",
    allowedChanges:Object.freeze({players:Object.freeze([]),scores:Object.freeze([]),metrics:Object.freeze([]),teams:Object.freeze([]),managers:Object.freeze([])}),
    domainPartitions:Object.freeze({metrics:Object.freeze([
      Object.freeze({name:"metrics",label:"PROTECTED NON-PRODUCTION METRICS",filter:Object.freeze({not:Object.freeze({all:Object.freeze([Object.freeze({field:"source",equals:"Fantrax"}),Object.freeze({field:"metric_type",equals:"fantrax_league_production"})])})}),expectedMutable:false}),
      Object.freeze({name:"fantraxProductionMetrics",label:"FANTRAX LEAGUE-PRODUCTION METRICS",filter:Object.freeze({all:Object.freeze([Object.freeze({field:"source",equals:"Fantrax"}),Object.freeze({field:"metric_type",equals:"fantrax_league_production"})])}),expectedMutable:true})
    ])})
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
function matchesFilter(row,filter){
  if(!filter)return true;
  if(Array.isArray(filter.all))return filter.all.every(item=>matchesFilter(row,item));
  if(Array.isArray(filter.any))return filter.any.some(item=>matchesFilter(row,item));
  if(filter.not)return !matchesFilter(row,filter.not);
  const equal=String(row?.[filter.field]??"").toLowerCase()===String(filter.equals??"").toLowerCase();
  return filter.negate?!equal:equal;
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
    for(const sourceName of ["players","scores","metrics","teams","managers"]){
      const partitions=contract.domainPartitions?.[sourceName]||[{name:sourceName,label:sourceName.toUpperCase(),expectedMutable:false}];
      for(const partition of partitions){
        const selected=(rows[sourceName]||[]).filter(row=>matchesFilter(row,partition.filter));
        const canonical=canonicalProtectedRows(selected,contract.allowedChanges[sourceName]||[]);
        domains[partition.name]=Object.freeze({domain:partition.label||partition.name.toUpperCase(),sourceDomain:sourceName,status:"AVAILABLE",count:selected.length,hash:await protectedDigest(canonical,{cryptoImpl:dependencies.cryptoImpl}),expectedMutable:Boolean(partition.expectedMutable),capturedAt,profile:contract.id,contractVersion:contract.version});
      }
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
  const domains={};let changed=false,expectedMutation=false;
  for(const name of Object.keys(before.domains)){
    const prior=before.domains[name],next=after.domains[name],same=prior?.count===next?.count&&prior?.hash===next?.hash;
    const status=same?"UNCHANGED":prior?.expectedMutable&&next?.expectedMutable?"EXPECTED_MUTATION":"CHANGED";
    domains[name]=Object.freeze({status,before:prior,after:next});if(status==="CHANGED")changed=true;if(status==="EXPECTED_MUTATION")expectedMutation=true;
  }
  return immutable({status:changed?"CHANGED":expectedMutation?"EXPECTED_MUTATION":"UNCHANGED",domains,errors:[]});
}
