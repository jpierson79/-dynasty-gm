const PROVIDER="Baseball Savant";
const BASE_URL="https://baseballsavant.mlb.com/leaderboard";
const DEFAULT_TIMEOUT_MS=30000;

function clean(value){return String(value??"").replace(/^\uFEFF/,"").trim()}
function csvRows(text){
  if(typeof text!=="string"||!text.trim())throw new Error("Baseball Savant returned an empty CSV response.");
  const rows=[];let row=[],cell="",quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index],next=text[index+1];
    if(char==='"'&&quoted&&next==='"'){cell+='"';index++;continue}
    if(char==='"'){quoted=!quoted;continue}
    if(!quoted&&(char===","||char==="\n")){
      row.push(clean(cell));cell="";
      if(char==="\n"){if(row.some(Boolean))rows.push(row);row=[]}
      continue;
    }
    if(char!=="\r")cell+=char;
  }
  if(quoted)throw new Error("Baseball Savant returned malformed quoted CSV data.");
  row.push(clean(cell));if(row.some(Boolean))rows.push(row);
  if(rows.length<2)throw new Error("Baseball Savant CSV contains no data rows.");
  const headers=rows.shift().map(clean);
  if(new Set(headers).size!==headers.length)throw new Error("Baseball Savant CSV contains duplicate headers.");
  return {headers,rows:rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,clean(values[index])])))};
}
function numberOrNull(value){
  if(value===null||value===undefined||clean(value)==="")return null;
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:null;
}
function requiredHeaders(actual,required,sourceType){
  const missing=required.filter(header=>!actual.includes(header));
  if(missing.length)throw new Error(`${sourceType} schema drift: missing ${missing.join(", ")}.`);
}
function canonicalCsvPayload({headers,rows}){
  const canonicalRows=rows.map(row=>headers.map(header=>clean(row[header]))).sort((left,right)=>JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify({headers,rows:canonicalRows});
}
async function sha256(value){
  if(!globalThis.crypto?.subtle)throw new Error("Web Crypto is required for Statcast snapshot checksums.");
  const bytes=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
function sourceUrl(sourceType,playerType,season){
  const query=new URLSearchParams({year:String(season),position:"",team:"",min:"1",csv:"true"});
  if(sourceType!=="sprint_speed")query.set("type",playerType);
  return `${BASE_URL}/${sourceType}?${query}`;
}
async function fetchCsv({sourceType,playerType,season,fetchImpl,timeoutMs}){
  const endpoint=sourceUrl(sourceType,playerType,season),controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(endpoint,{method:"GET",credentials:"omit",headers:{accept:"text/csv"},signal:controller.signal});
    if(!response?.ok)throw new Error(`${sourceType} request failed with HTTP ${response?.status||"unknown"}.`);
    const contentType=String(response.headers?.get?.("content-type")||"").toLowerCase();
    if(!contentType.includes("text/csv"))throw new Error(`${sourceType} returned unsupported content type ${contentType||"unknown"}.`);
    const raw=await response.text(),parsed=csvRows(raw),fetchedAt=new Date().toISOString();
    return {provider:PROVIDER,sourceType,endpoint,season,fetchedAt,rowCount:parsed.rows.length,headers:parsed.headers,schemaVersion:await sha256(parsed.headers.join("\u001f")),checksum:await sha256(canonicalCsvPayload(parsed)),warnings:[],rows:parsed.rows};
  }catch(error){
    if(error?.name==="AbortError")throw new Error(`${sourceType} request timed out.`);
    throw error;
  }finally{clearTimeout(timer)}
}
function mergeRows(sources){
  const merged=new Map(),invalidRows=[];
  for(const source of sources){
    for(const row of source.rows){
      const mlbamId=clean(row.player_id);
      if(!/^\d+$/.test(mlbamId)){invalidRows.push({sourceType:source.sourceType,row,reason:"MISSING_OR_INVALID_MLBAM"});continue}
      const current=merged.get(mlbamId)||{mlbamId,playerName:clean(row["last_name, first_name"]),values:{},sourceTypes:[]};
      current.sourceTypes.push(source.sourceType);
      Object.assign(current.values,row);
      merged.set(mlbamId,current);
    }
  }
  return {rows:[...merged.values()],invalidRows};
}
function hitterMetrics(values){return {
  pa:numberOrNull(values.pa),bip:numberOrNull(values.bip),ba:numberOrNull(values.ba),xba:numberOrNull(values.est_ba),
  slg:numberOrNull(values.slg),xslg:numberOrNull(values.est_slg),woba:numberOrNull(values.woba),xwoba:numberOrNull(values.est_woba),
  battedBallEvents:numberOrNull(values.attempts),averageLaunchAngle:numberOrNull(values.avg_hit_angle),sweetSpotRate:numberOrNull(values.anglesweetspotpercent),
  maxExitVelocity:numberOrNull(values.max_hit_speed),averageExitVelocity:numberOrNull(values.avg_hit_speed),hardHitCount:numberOrNull(values.ev95plus),
  hardHitRate:numberOrNull(values.ev95percent),barrels:numberOrNull(values.barrels),barrelRate:numberOrNull(values.brl_percent),barrelsPerPa:numberOrNull(values.brl_pa),
  sprintSpeed:numberOrNull(values.sprint_speed)
}}
function pitcherMetrics(values){return {
  pa:numberOrNull(values.pa),bip:numberOrNull(values.bip),baAllowed:numberOrNull(values.ba),xbaAllowed:numberOrNull(values.est_ba),
  slgAllowed:numberOrNull(values.slg),xslgAllowed:numberOrNull(values.est_slg),wobaAllowed:numberOrNull(values.woba),xwobaAllowed:numberOrNull(values.est_woba),
  era:numberOrNull(values.era),xera:numberOrNull(values.xera),battedBallEvents:numberOrNull(values.attempts),
  averageLaunchAngleAllowed:numberOrNull(values.avg_hit_angle),sweetSpotRateAllowed:numberOrNull(values.anglesweetspotpercent),
  maxExitVelocityAllowed:numberOrNull(values.max_hit_speed),averageExitVelocityAllowed:numberOrNull(values.avg_hit_speed),
  hardHitCountAllowed:numberOrNull(values.ev95plus),hardHitRateAllowed:numberOrNull(values.ev95percent),barrelsAllowed:numberOrNull(values.barrels),
  barrelRateAllowed:numberOrNull(values.brl_percent),barrelsPerPaAllowed:numberOrNull(values.brl_pa)
}}
function stripNulls(metrics){return Object.fromEntries(Object.entries(metrics).filter(([,value])=>value!==null))}

export async function fetchStatcastSnapshot({playerType,season,fetchImpl=globalThis.fetch,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  if(!["hitter","pitcher"].includes(playerType))throw new Error("Statcast player type must be hitter or pitcher.");
  const year=Number(season),currentYear=new Date().getUTCFullYear();
  if(!Number.isInteger(year)||year<2015||year>currentYear)throw new Error("Statcast season is unsupported.");
  if(typeof fetchImpl!=="function")throw new Error("A fetch implementation is required.");
  const specifications=[
    {sourceType:"expected_statistics",required:["last_name, first_name","player_id","year","pa","bip","ba","est_ba","slg","est_slg","woba","est_woba",...(playerType==="pitcher"?["era","xera"]:[])]},
    {sourceType:"statcast",required:["last_name, first_name","player_id","attempts","avg_hit_angle","anglesweetspotpercent","max_hit_speed","avg_hit_speed","ev95plus","ev95percent","barrels","brl_percent","brl_pa"]},
    ...(playerType==="hitter"?[{sourceType:"sprint_speed",required:["last_name, first_name","player_id","sprint_speed"]}]:[])
  ];
  const sources=await Promise.all(specifications.map(async specification=>{
    const source=await fetchCsv({sourceType:specification.sourceType,playerType,season:year,fetchImpl,timeoutMs});
    requiredHeaders(source.headers,specification.required,source.sourceType);
    return source;
  }));
  const merged=mergeRows(sources),rows=merged.rows.map(row=>({...row,metrics:stripNulls(playerType==="hitter"?hitterMetrics(row.values):pitcherMetrics(row.values))}));
  if(!rows.length)throw new Error("Baseball Savant returned no rows with valid MLBAM player IDs.");
  return {provider:PROVIDER,playerType,season:year,fetchedAt:sources.map(source=>source.fetchedAt).sort().at(-1),sources,rows,invalidRows:merged.invalidRows,warnings:merged.invalidRows.map(row=>({reason:row.reason,sourceType:row.sourceType}))};
}

export async function fetchHitterSeasonMetrics(options={}){return fetchStatcastSnapshot({...options,playerType:"hitter"})}
export async function fetchPitcherSeasonMetrics(options={}){return fetchStatcastSnapshot({...options,playerType:"pitcher"})}
export const baseballSavantProviderInfo=Object.freeze({provider:PROVIDER,minimumSeason:2015,credentialMode:"omit",responseType:"text/csv"});
