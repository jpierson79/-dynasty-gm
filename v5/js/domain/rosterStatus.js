export const NORMALIZED_ROSTER_STATUSES=["ACTIVE","RESERVE","IL","MINORS","UNCLASSIFIED","FREE_AGENT"];

export function normalizeRosterStatus(rawValue,{ownerTeamId=null,isFreeAgent=false,availabilityStatus=""}={}){
  const raw=String(rawValue||"").trim();
  const availability=String(availabilityStatus||"").trim();
  const text=`${raw} ${availability}`.replace(/[_-]+/g," ").replace(/\s+/g," ").trim().toUpperCase();
  if(ownerTeamId&&/\b(FREE AGENT|FA|AVAILABLE|WAIVER|WAIVERS|W)\b/.test(text))return"UNCLASSIFIED";
  if(!ownerTeamId&&(/\b(FREE AGENT|FA|AVAILABLE|WAIVER|WAIVERS)\b/.test(text)||isFreeAgent))return"FREE_AGENT";
  if(/\b(IL|IL10|IL15|IL60|IR|INJURED RESERVE|INJURED|DL)\b/.test(text))return"IL";
  if(/\b(MINORS|MINOR LEAGUE|MILB|FARM|NA|N\/A)\b/.test(text))return"MINORS";
  if(/\b(RESERVE|BENCH|BN)\b/.test(text))return"RESERVE";
  if(/\b(ACTIVE|STARTER|STARTING|LINEUP)\b/.test(text))return"ACTIVE";
  if(!ownerTeamId)return"FREE_AGENT";
  return"UNCLASSIFIED";
}

export function rosterGroupLabel(rawValue,context={}){
  const normalized=normalizeRosterStatus(rawValue,context);
  if(normalized==="FREE_AGENT")return"Free Agent";
  if(normalized==="MINORS")return"Minors";
  if(normalized==="UNCLASSIFIED")return"Unclassified";
  return normalized.charAt(0)+normalized.slice(1).toLowerCase();
}
