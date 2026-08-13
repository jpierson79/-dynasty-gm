const TYPES=Object.freeze(["hitter","pitcher"]);
function typeState(value={}){return {preview:null,reviewed:false,running:false,result:null,error:"",...value}}
function executionId(){return globalThis.crypto?.randomUUID?.()||`statcast-${Date.now()}-${Math.random().toString(16).slice(2)}`}
export function normalizeStatcastTypeOutcome(value){
  const status=String(value?.status||value||"").trim().toUpperCase();
  if(["SUCCESS","COMPLETED"].includes(status))return"SUCCESS";
  if(status==="PARTIAL")return"PARTIAL";
  if(["FAILED","FAILURE","BLOCKED","QUERY_FAILED","UNAVAILABLE","RUNNING"].includes(status))return status;
  return"NOT_RUN";
}
export function statcastTypeOutcome(item={}){return item.error?"FAILED":normalizeStatcastTypeOutcome(item.result)}
export function statcastSessionStatus(types,intendedTypes=TYPES){
  const intended=[...new Set(intendedTypes)].filter(type=>TYPES.includes(type));
  if(!intended.length)return"NOT_RUN";
  const outcomes=intended.map(type=>statcastTypeOutcome(types?.[type]));
  if(outcomes.every(status=>status==="SUCCESS"))return"SUCCESS";
  if(outcomes.some(status=>status==="PARTIAL"))return"PARTIAL";
  const succeeded=outcomes.some(status=>status==="SUCCESS"),failed=outcomes.some(status=>status!=="SUCCESS"&&status!=="NOT_RUN"),notRun=outcomes.some(status=>status==="NOT_RUN");
  if(succeeded&&(failed||notRun))return"PARTIAL";
  if(failed&&!succeeded)return"FAILED";
  return"NOT_RUN";
}
export function createStatcastRefreshSession({leagueId="",season=new Date().getUTCFullYear(),contextSignature="",protectedBaseline={running:false,evidence:null,error:""}}={}){return {leagueId,season,contextSignature,sessionStatus:"NOT_RUN",lastIntendedTypes:[],refreshSessionId:"",protectedBaseline,types:{hitter:typeState(),pitcher:typeState()}}}
export function invalidateStatcastRefreshSession(session,{leagueId=session?.leagueId||"",season=session?.season||new Date().getUTCFullYear(),contextSignature=session?.contextSignature||""}={}){return createStatcastRefreshSession({leagueId,season,contextSignature})}
export function beginStatcastPreview(session,type){return {...session,types:{...session.types,[type]:typeState({...session.types[type],preview:null,reviewed:false,running:true,result:null,error:""})}}}
export function finishStatcastPreview(session,type,preview){return {...session,types:{...session.types,[type]:typeState({...session.types[type],preview,reviewed:false,running:false,result:null,error:""})}}}
export function failStatcastPreview(session,type,error){return {...session,types:{...session.types,[type]:typeState({...session.types[type],preview:null,reviewed:false,running:false,result:null,error:String(error?.message||error)})}}}
export function reviewStatcastPreview(session,type,reviewed){const current=session.types[type];return {...session,types:{...session.types,[type]:{...current,reviewed:Boolean(reviewed)&&current.preview?.status==="READY"}}}}
export function statcastTypeCanApply(session,type){const item=session?.types?.[type];return Boolean(item?.preview?.status==="READY"&&item.reviewed&&!item.running&&!item.result)}
export async function applyStatcastSessionTypes(session,types,{leagueId=session.leagueId,applyType}={}){
  const intendedTypes=[...new Set(types)],refreshSessionId=executionId(),startedAt=new Date().toISOString();
  let next={...session,lastIntendedTypes:intendedTypes,refreshSessionId};for(const type of intendedTypes){if(!TYPES.includes(type))throw new Error(`Unsupported Statcast player type: ${type}`);if(!statcastTypeCanApply(next,type))throw new Error(`Preview and review ${type} Statcast data before applying.`)}
  for(let index=0;index<intendedTypes.length;index++){const type=intendedTypes[index],current=next.types[type];next={...next,types:{...next.types,[type]:{...current,running:true,error:""}}};try{const result=await applyType({leagueId,playerType:type,reviewedPreview:current.preview,refreshSession:{id:refreshSessionId,intendedTypes,sequence:index+1,startedAt}});next={...next,types:{...next.types,[type]:{...current,running:false,preview:null,reviewed:false,result,error:""}}}}catch(error){next={...next,types:{...next.types,[type]:{...current,running:false,result:null,error:String(error?.message||error)}}};return {...next,sessionStatus:statcastSessionStatus(next.types,intendedTypes)}}}return {...next,sessionStatus:statcastSessionStatus(next.types,intendedTypes)}
}
export const STATCAST_REFRESH_SESSION_TYPES=TYPES;
