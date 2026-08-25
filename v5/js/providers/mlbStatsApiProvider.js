import {mergeProspectLevelEvidence,normalizeProspectLevel} from "../services/prospectLevelEvidence.js";

const BASE_URL="https://statsapi.mlb.com/api/v1";
const DEFAULT_SPORT_IDS=[1,11,12,13,14,15,16,17];
const DEFAULT_TIMEOUT_MS=30000;

function clean(value){return String(value??"").trim()}
async function fetchJson(url,{fetchImpl,timeoutMs}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetchImpl(url,{method:"GET",credentials:"omit",headers:{accept:"application/json"},signal:controller.signal});
    if(!response?.ok)throw new Error(`MLB Stats API request failed with HTTP ${response?.status||"unknown"}.`);
    const type=clean(response.headers?.get?.("content-type")).toLowerCase();
    if(!type.includes("application/json"))throw new Error(`MLB Stats API returned unsupported content type ${type||"unknown"}.`);
    return await response.json();
  }catch(error){if(error?.name==="AbortError")throw new Error("MLB Stats API request timed out.");throw error}
  finally{clearTimeout(timer)}
}
function personRow(person,sportId){
  const id=Number(person?.id),fullName=clean(person?.fullName);
  if(!Number.isInteger(id)||id<=0||!fullName)return null;
  const team=person.currentTeam||{};
  const active=person.active!==false;
  return {mlbamId:String(id),fullName,active,birthDate:clean(person.birthDate),sportId:Number(sportId),primaryPosition:clean(person.primaryPosition?.abbreviation||person.primaryPosition?.code),currentTeam:{id:Number(team.id)||null,name:clean(team.name),abbreviation:clean(team.abbreviation),teamCode:clean(team.teamCode),fileCode:clean(team.fileCode),parentOrgId:Number(team.parentOrgId)||null},levelEvidence:normalizeProspectLevel({sportId,active,source:"MLB_STATS_API",rawEvidence:{sportId:Number(sportId),active}})};
}
function mergePerson(current,next){
  if(!current)return {...next,sportIds:[next.sportId]};
  const preferred=current.currentTeam?.id?current:next;
  return {...current,...preferred,active:current.active||next.active,sportIds:[...new Set([...(current.sportIds||[]),next.sportId])].sort((a,b)=>a-b),levelEvidence:mergeProspectLevelEvidence([current.levelEvidence,next.levelEvidence])};
}

export async function fetchMlbIdentityCatalog({season=new Date().getUTCFullYear(),sportIds=DEFAULT_SPORT_IDS,fetchImpl=globalThis.fetch,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  const year=Number(season);
  if(!Number.isInteger(year)||year<2000||year>new Date().getUTCFullYear())throw new Error("MLB identity catalog season is unsupported.");
  if(!Array.isArray(sportIds)||!sportIds.length||sportIds.some(id=>!Number.isInteger(Number(id))))throw new Error("At least one valid MLB sport ID is required.");
  if(typeof fetchImpl!=="function")throw new Error("A fetch implementation is required.");
  const teamUrl=`${BASE_URL}/teams?${new URLSearchParams({sportIds:[...new Set([1,...sportIds.map(Number)])].join(","),season:String(year)})}`;
  const [teamPayload,...sportPayloads]=await Promise.all([
    fetchJson(teamUrl,{fetchImpl,timeoutMs}),
    ...sportIds.map(id=>fetchJson(`${BASE_URL}/sports/${Number(id)}/players?${new URLSearchParams({season:String(year),hydrate:"currentTeam,primaryPosition"})}`,{fetchImpl,timeoutMs}))
  ]);
  if(!Array.isArray(teamPayload?.teams))throw new Error("MLB Stats API team response is malformed.");
  const teams=teamPayload.teams.map(team=>({id:Number(team.id),name:clean(team.name),abbreviation:clean(team.abbreviation),teamCode:clean(team.teamCode),fileCode:clean(team.fileCode),parentOrgId:Number(team.parentOrgId)||null,parentOrgName:clean(team.parentOrgName)})).filter(team=>Number.isInteger(team.id)),teamById=new Map(teams.map(team=>[team.id,team]));
  const people=new Map(),invalid=[];
  sportPayloads.forEach((payload,index)=>{
    if(!Array.isArray(payload?.people))throw new Error(`MLB Stats API sport ${sportIds[index]} response is malformed.`);
    payload.people.forEach((person,rowIndex)=>{const normalized=personRow(person,sportIds[index]);if(!normalized)invalid.push({sportId:sportIds[index],rowIndex,reason:"MALFORMED_PERSON"});else{normalized.currentTeam={...teamById.get(normalized.currentTeam.id),...normalized.currentTeam,parentOrgId:teamById.get(normalized.currentTeam.id)?.parentOrgId||normalized.currentTeam.parentOrgId};people.set(normalized.mlbamId,mergePerson(people.get(normalized.mlbamId),normalized))}});
  });
  const fetchedAt=new Date().toISOString();
  return {provider:"MLB Stats API",season:year,fetchedAt,sportIds:sportIds.map(Number),teams,people:[...people.values()].sort((a,b)=>Number(a.mlbamId)-Number(b.mlbamId)),invalid,warnings:invalid.map(row=>({reason:row.reason,sportId:row.sportId}))};
}

export const mlbStatsApiProviderInfo=Object.freeze({provider:"MLB Stats API",baseUrl:BASE_URL,credentialMode:"omit",defaultSportIds:DEFAULT_SPORT_IDS});
