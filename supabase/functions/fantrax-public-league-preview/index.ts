import {FANTRAX_OPERATIONS,normalizeFantraxResponse,validExternalLeagueId} from "../_shared/fantraxPreviewCore.js";

const MAX_RESPONSE_BYTES=1_500_000;
const TIMEOUT_MS=8_000;
const headers={"content-type":"application/json","cache-control":"private, max-age=30","vary":"authorization","access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS"};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});

Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers});
  if(request.method!=="POST")return reply(405,{error:"POST required."});
  try{
    const input=await request.json();
    const operation=String(input?.operation||"");
    const endpoint=FANTRAX_OPERATIONS[operation as keyof typeof FANTRAX_OPERATIONS];
    if(!endpoint)return reply(400,{error:"Operation is not allowlisted."});
    const externalLeagueId=String(input?.externalLeagueId||Deno.env.get("FANTRAX_PUBLIC_LEAGUE_ID")||"").trim();
    if(!validExternalLeagueId(externalLeagueId))return reply(400,{error:"A configured 16-character Fantrax league ID is required."});
    const period=input?.period===null||input?.period===undefined||input?.period===""?null:Number(input.period);
    if(period!==null&&(!Number.isInteger(period)||period<1))return reply(400,{error:"Period must be a positive integer."});
    const url=new URL(`https://www.fantrax.com/fxea/general/${endpoint}`);
    url.searchParams.set("leagueId",externalLeagueId);
    if(period!==null&&["team-rosters","matchup-scores"].includes(operation))url.searchParams.set("period",String(period));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    let response:Response;
    try{response=await fetch(url,{method:"GET",signal:controller.signal,credentials:"omit",headers:{accept:"application/json,text/plain;q=0.9"}})}finally{clearTimeout(timer)}
    if(!response.ok)return reply(502,{error:`Fantrax request failed with HTTP ${response.status}.`,operation,httpStatus:response.status});
    const declared=Number(response.headers.get("content-length")||0);
    if(declared>MAX_RESPONSE_BYTES)return reply(502,{error:"Fantrax response exceeded the size limit.",operation});
    const body=await response.text();
    if(new TextEncoder().encode(body).byteLength>MAX_RESPONSE_BYTES)return reply(502,{error:"Fantrax response exceeded the size limit.",operation});
    let raw:unknown;
    try{raw=JSON.parse(body)}catch{return reply(502,{error:"Fantrax returned malformed JSON.",operation})}
    let data:unknown;
    try{data=normalizeFantraxResponse(operation,raw)}catch(error){return reply(502,{error:String(error?.message||error),operation,schemaValid:false})}
    return reply(200,{operation,httpStatus:response.status,schemaValid:true,data});
  }catch(error){
    const timeout=error instanceof DOMException&&error.name==="AbortError";
    return reply(timeout?504:500,{error:timeout?"Fantrax request timed out.":String(error?.message||error)});
  }
});
