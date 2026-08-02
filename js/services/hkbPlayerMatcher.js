const DRAFT_PICK_ASSET=/^(20\d{2})\s+(Early|Mid|Late)\s+([123])(st|nd|rd)$/i;

const TEAM_ALIASES=Object.freeze({
  ARI:"ARI",AZ:"ARI",ATH:"ATH",OAK:"ATH",CHW:"CHW",CWS:"CHW",KC:"KC",KCR:"KC",
  SD:"SD",SDP:"SD",SF:"SF",SFG:"SF",TB:"TB",TBR:"TB",WSH:"WSH",WAS:"WSH"
});

export const HKB_DIAGNOSTIC=Object.freeze({
  NON_PLAYER_ASSET:"NON_PLAYER_ASSET",
  INVALID_SOURCE_ROW:"INVALID_SOURCE_ROW",
  EXACT_NAME_NOT_FOUND:"EXACT_NAME_NOT_FOUND",
  NORMALIZATION_MISMATCH:"NORMALIZATION_MISMATCH",
  AMBIGUOUS_NAME:"AMBIGUOUS_NAME",
  CONTEXT_CONFLICT:"CONTEXT_CONFLICT",
  PLAYER_ABSENT_FROM_CLOUD:"PLAYER_ABSENT_FROM_CLOUD",
  SAFE_CONTEXTUAL_MATCH_AVAILABLE:"SAFE_CONTEXTUAL_MATCH_AVAILABLE",
  UNKNOWN:"UNKNOWN"
});

export function normalizeHkbPlayerName(value){
  return String(value||"")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[\u2018\u2019\u02BC']/g,"")
    .replace(/[-\u2010-\u2015]/g," ")
    .replace(/\./g,"")
    .replace(/[^a-zA-Z0-9\s]/g," ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g," ");
}

export function normalizeHkbTeam(value){
  const team=String(value||"").trim().toUpperCase().replace(/[^A-Z]/g,"");
  if(!team||["FA","FREEAGENT","NA","N/A"].includes(team))return "";
  return TEAM_ALIASES[team]||team;
}

export function normalizeHkbPositions(value){
  const values=Array.isArray(value)?value:String(value||"").split(/[\/,\s]+/);
  return [...new Set(values.map(item=>String(item||"").trim().toUpperCase()).filter(Boolean))].sort();
}

export function isHkbDraftPickAsset(value){
  return DRAFT_PICK_ASSET.test(String(value||"").trim());
}

function playerName(player){return String(player?.name||player?.player_name||player?.playerName||"").trim()}
function playerTeam(player){return normalizeHkbTeam(player?.mlb_team||player?.mlbTeam||player?.organization||player?.org||player?.team)}
function playerPositions(player){return normalizeHkbPositions(player?.positions||player?.position)}
function overlaps(left,right){const values=new Set(left);return right.some(value=>values.has(value))}
function displayComparable(value){
  return String(value||"").normalize("NFC").toLowerCase().trim().replace(/\s+/g," ");
}
function candidateDetail(player){
  return {
    id:player?.id||"",
    name:playerName(player),
    mlbTeam:playerTeam(player),
    positions:playerPositions(player),
    ownerTeamId:player?.owner_team_id||"",
    rosterStatus:player?.roster_status||""
  };
}
function resolution(category,suggestedResolution,extra={}){
  return {category,suggestedResolution,...extra};
}

export function createHkbPlayerMatcher(players=[]){
  const byName=new Map();
  players.forEach(player=>{
    const key=normalizeHkbPlayerName(playerName(player));
    if(!key)return;
    const candidates=byName.get(key)||[];
    candidates.push(player);
    byName.set(key,candidates);
  });

  return function matchHkbPlayer(row={}){
    const sourceName=String(row.name||row.player_name||row.playerName||"").trim();
    const normalizedName=normalizeHkbPlayerName(sourceName);
    const sourceTeam=normalizeHkbTeam(row.team||row.mlb_team||row.org);
    const sourcePositions=normalizeHkbPositions(row.positions||row.position);
    const base={sourceName,normalizedName,sourceTeam,sourcePositions,sourceLevel:String(row.level||"").trim()};
    if(isHkbDraftPickAsset(sourceName))return resolution(HKB_DIAGNOSTIC.NON_PLAYER_ASSET,"Preserve this row for a future draft-pick valuation feature; do not import it as a player.",base);
    if(!sourceName||!normalizedName)return resolution(HKB_DIAGNOSTIC.INVALID_SOURCE_ROW,"Supply a valid player name before previewing again.",base);
    const candidates=byName.get(normalizedName)||[];
    const details=candidates.map(candidateDetail);
    if(!candidates.length)return resolution(HKB_DIAGNOSTIC.PLAYER_ABSENT_FROM_CLOUD,"Import the player through the canonical Fantrax player-pool workflow, then preview HKB again.",{...base,candidateCount:0,candidates:[]});
    if(candidates.length===1){
      const player=candidates[0];
      const normalizationChanged=displayComparable(sourceName)!==displayComparable(playerName(player));
      return resolution(normalizationChanged?HKB_DIAGNOSTIC.NORMALIZATION_MISMATCH:"UNIQUE_NORMALIZED_NAME_MATCH",normalizationChanged?"Name matched safely after canonical diacritic/punctuation normalization.":"Unique canonical name matched one existing cloud player.",{...base,status:"matched",matchSource:"normalized_name",player,candidateCount:1,candidates:details});
    }

    let narrowed=candidates;
    if(sourceTeam){
      const exactTeam=narrowed.filter(player=>playerTeam(player)===sourceTeam);
      const unknownTeam=narrowed.filter(player=>!playerTeam(player));
      if(exactTeam.length)narrowed=exactTeam;
      else if(unknownTeam.length)narrowed=unknownTeam;
      else narrowed=[];
    }
    if(sourcePositions.length)narrowed=narrowed.filter(player=>overlaps(sourcePositions,playerPositions(player)));
    if(narrowed.length===1){
      return resolution(HKB_DIAGNOSTIC.SAFE_CONTEXTUAL_MATCH_AVAILABLE,"Team and position context uniquely identified an existing cloud player.",{...base,status:"matched",matchSource:"context",player:narrowed[0],candidateCount:candidates.length,candidates:details});
    }
    if(!narrowed.length&&(sourceTeam||sourcePositions.length)){
      return resolution(HKB_DIAGNOSTIC.CONTEXT_CONFLICT,"The source team or position conflicts with every same-name cloud candidate; correct the source context or skip the row.",{...base,status:"unmatched",candidateCount:candidates.length,candidates:details});
    }
    return resolution(HKB_DIAGNOSTIC.AMBIGUOUS_NAME,"Multiple cloud players share this name and the supplied context does not identify exactly one; skip the row.",{...base,status:"unmatched",candidateCount:candidates.length,candidates:details});
  };
}

export function summarizeHkbClassifications(classifications=[]){
  const counts={totalSourceRows:classifications.length,playerRows:0,nonPlayerAssets:0,stableIdMatches:0,uniqueNormalizedNameMatches:0,contextualMatches:0,ambiguousRows:0,normalizationMismatches:0,playersAbsentFromCloud:0,invalidRows:0,unmatchedRows:0,contextConflicts:0};
  classifications.forEach(item=>{
    if(item.category===HKB_DIAGNOSTIC.NON_PLAYER_ASSET){counts.nonPlayerAssets++;return}
    counts.playerRows++;
    if(item.status!=="matched")counts.unmatchedRows++;
    if(item.category==="UNIQUE_NORMALIZED_NAME_MATCH")counts.uniqueNormalizedNameMatches++;
    if(item.category===HKB_DIAGNOSTIC.NORMALIZATION_MISMATCH){counts.uniqueNormalizedNameMatches++;counts.normalizationMismatches++}
    if(item.category===HKB_DIAGNOSTIC.SAFE_CONTEXTUAL_MATCH_AVAILABLE)counts.contextualMatches++;
    if(item.category===HKB_DIAGNOSTIC.AMBIGUOUS_NAME)counts.ambiguousRows++;
    if(item.category===HKB_DIAGNOSTIC.CONTEXT_CONFLICT)counts.contextConflicts++;
    if(item.category===HKB_DIAGNOSTIC.PLAYER_ABSENT_FROM_CLOUD)counts.playersAbsentFromCloud++;
    if(item.category===HKB_DIAGNOSTIC.INVALID_SOURCE_ROW)counts.invalidRows++;
  });
  return counts;
}
