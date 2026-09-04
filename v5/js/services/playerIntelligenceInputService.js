import * as leagueRepository from "../repositories/leagueRepository.js";
import * as metricRepository from "../repositories/metricRepository.js";
import * as playerRepository from "../repositories/playerRepository.js";
import {LEVEL_AVAILABILITY,PROSPECT_LEVELS,PROSPECT_LEVEL_SCHEMA_STATES,withProspectLevelSchemaState} from "./prospectLevelEvidence.js";

export const PLAYER_INTELLIGENCE_INPUT_VERSION="5.5B-1";
export const INPUT_AVAILABILITY=Object.freeze({AVAILABLE:"AVAILABLE",STALE:"STALE",MISSING:"MISSING",UNAVAILABLE:"UNAVAILABLE",QUERY_FAILED:"QUERY_FAILED"});
export const SUPPORTED_POSITIONS=Object.freeze(["C","1B","2B","3B","SS","OF","SP","RP"]);
const STATCAST_SOURCE="Statcast",STATCAST_TYPES={hitter:"statcast_hitting",pitcher:"statcast_pitching"};
const FANTRAX_SOURCE="Fantrax",FANTRAX_PRODUCTION_TYPE="fantrax_league_production";
const HITTER_KEYS={pa:["pa"],bip:["bip"],ba:["ba"],xba:["xba","x_ba"],slg:["slg"],xslg:["xslg","x_slg"],woba:["woba"],xwoba:["xwoba","x_woba"],barrelRate:["barrelRate","barrel_batted_rate","barrel_rate"],hardHitRate:["hardHitRate","hard_hit_percent","hard_hit_rate"],averageExitVelocity:["averageExitVelocity","avg_exit_velocity","average_exit_velocity"],maxExitVelocity:["maxExitVelocity","max_exit_velocity"],launchAngle:["launchAngle","launch_angle"],sweetSpotRate:["sweetSpotRate","sweet_spot_rate"],sprintSpeed:["sprintSpeed","sprint_speed"]};
const PITCHER_KEYS={pa:["pa"],bip:["bip"],era:["era"],xera:["xera","x_era"],xwobaAllowed:["xwobaAllowed","xwoba_allowed"],barrelRateAllowed:["barrelRateAllowed","barrel_rate_allowed","barrel_batted_rate"],hardHitRateAllowed:["hardHitRateAllowed","hard_hit_rate_allowed","hard_hit_percent"],averageExitVelocityAllowed:["averageExitVelocityAllowed","average_exit_velocity_allowed","avg_exit_velocity"]};

function value(source,aliases){for(const key of aliases)if(source[key]!==undefined&&source[key]!==null&&source[key]!=="")return source[key];return null}
function canonicalMetrics(source,map){return Object.fromEntries(Object.entries(map).map(([key,aliases])=>[key,value(source,aliases)]).filter(([,entry])=>entry!==null))}
function iso(value){const time=Date.parse(value||"");return Number.isFinite(time)?new Date(time).toISOString():null}
function freshness({source,season,fetchedAt,asOfDate,maxAgeMs}){
  if(!source)return {status:INPUT_AVAILABILITY.MISSING,source:null,season:season??null,fetchedAt:null,ageMs:null};
  const fetched=iso(fetchedAt),asOf=Date.parse(asOfDate);
  if(!fetched)return {status:INPUT_AVAILABILITY.UNAVAILABLE,source,season:season??null,fetchedAt:null,ageMs:null};
  const ageMs=Math.max(0,asOf-Date.parse(fetched));
  return {status:ageMs>maxAgeMs?INPUT_AVAILABILITY.STALE:INPUT_AVAILABILITY.AVAILABLE,source,season:season??null,fetchedAt:fetched,ageMs};
}
function positions(raw){const source=Array.isArray(raw)?raw:String(raw||"").split(/[\/,\s]+/);return {source:source.filter(Boolean),eligible:[...new Set(source.map(item=>String(item).trim().toUpperCase()).filter(item=>SUPPORTED_POSITIONS.includes(item)))]}}
function warning(code,group,message,details={}){return {code,group,severity:"WARNING",message,details}}
function chooseMetric(rows,{playerId,season,type}){
  return (rows||[]).filter(row=>row.player_id===playerId&&row.source===STATCAST_SOURCE&&Number(row.season)===Number(season)&&row.metric_type===STATCAST_TYPES[type]).sort((a,b)=>String(b.imported_at||"").localeCompare(String(a.imported_at||"")))[0]||null;
}
function chooseProductionMetric(rows,{playerId,season}){
  return (rows||[]).filter(row=>row.player_id===playerId&&row.source===FANTRAX_SOURCE&&Number(row.season)===Number(season)&&row.metric_type===FANTRAX_PRODUCTION_TYPE).sort((a,b)=>String(b.imported_at||"").localeCompare(String(a.imported_at||"")))[0]||null;
}
export function buildPlayerMetricIndex(rows=[],season){
  const byPlayerId=new Map();
  for(const row of rows){
    if(Number(row.season)!==Number(season)||![STATCAST_SOURCE,FANTRAX_SOURCE].includes(row.source))continue;
    const acceptedType=row.source===STATCAST_SOURCE
      ? Object.values(STATCAST_TYPES).includes(row.metric_type)
      : row.metric_type===FANTRAX_PRODUCTION_TYPE;
    if(!acceptedType)continue;
    const current=byPlayerId.get(row.player_id)||{statcast_hitting:null,statcast_pitching:null,fantrax_league_production:null},previous=current[row.metric_type];
    if(!previous||String(row.imported_at||"").localeCompare(String(previous.imported_at||""))>0)current[row.metric_type]=row;
    byPlayerId.set(row.player_id,current);
  }
  return byPlayerId;
}
function leagueContext(league,season){const settings=league?.settings||{};return {leagueId:league?.id||null,name:league?.name||null,teamCount:league?.team_count??settings.teamCount??null,lineupSlots:settings.lineupSlots??settings.lineup_slots??null,rosterLimits:settings.rosterLimits??settings.roster_limits??null,minorLeagueLimit:settings.minorLeagueLimit??settings.minor_league_limit??null,eligibilityRules:settings.eligibilityRules??settings.eligibility_rules??null,scoringConfiguration:settings.scoringConfiguration??settings.scoring??league?.scoring_type??null,currentSeason:season??settings.currentSeason??settings.current_season??null,currentPeriod:settings.currentPeriod??settings.current_period??null};}

export function buildCanonicalPlayerIntelligenceInput({player,league,metricRows=[],metricsByPlayerId=null,season,asOfDate=new Date().toISOString(),staleAfterMs=48*60*60*1000}={}){
  if(!player?.id)throw new Error("Stable player UUID is required.");
  if(!league?.id)throw new Error("League context is required.");
  if(player.league_id&&player.league_id!==league.id)throw new Error("Player and league context do not match.");
  const positionEligibility=positions(player.positions),pitcher=positionEligibility.eligible.some(item=>item==="SP"||item==="RP"),type=pitcher?"pitcher":"hitter";
  const indexed=metricsByPlayerId?.get(player.id),metricRow=indexed?indexed[STATCAST_TYPES[type]]:chooseMetric(metricRows,{playerId:player.id,season,type}),raw=metricRow?.metrics||{},metadata=raw._statcast||raw.statcast||{};
  const productionRow=indexed?indexed[FANTRAX_PRODUCTION_TYPE]:chooseProductionMetric(metricRows,{playerId:player.id,season}),productionRaw=productionRow?.metrics||{},productionMetadata=productionRaw._fantraxProduction||{};
  const statcastFreshness=freshness({source:metricRow?.source,season:metricRow?.season??season,fetchedAt:metadata.fetchedAt||metricRow?.imported_at,asOfDate,maxAgeMs:staleAfterMs});
  const fantraxFreshness=freshness({source:productionRow?.source,season:productionRow?.season??season,fetchedAt:productionMetadata.importedAt||productionRow?.imported_at,asOfDate,maxAgeMs:staleAfterMs});
  const warnings=[];
  if(!metricRow)warnings.push(warning("STATCAST_MISSING","underlyingSkill","No accepted Statcast metric row is available for this player, season, and player type."));
  else if(statcastFreshness.status==="STALE")warnings.push(warning("STATCAST_STALE","underlyingSkill","The selected Statcast metric row is stale.",{fetchedAt:statcastFreshness.fetchedAt}));
  if(!productionRow)warnings.push(warning("FANTRAX_PRODUCTION_MISSING","production","No accepted Fantrax player-production row is available for this player and season."));
  else if(fantraxFreshness.status==="STALE")warnings.push(warning("FANTRAX_PRODUCTION_STALE","production","The selected Fantrax player-production row is stale.",{fetchedAt:fantraxFreshness.fetchedAt}));
  const hkbAvailable=player.hkb_value!==null&&player.hkb_value!==undefined&&player.hkb_value!=="";
  if(!hkbAvailable)warnings.push(warning("HKB_MISSING","market","No HKB market evidence is available."));
  else warnings.push(warning("HKB_FRESHNESS_UNAVAILABLE","market","HKB market evidence has no row-level freshness timestamp."));
  if(!player.mlbam_id)warnings.push(warning("MLBAM_IDENTITY_INCOMPLETE","player","MLBAM supporting identity is unavailable."));
  if(!positionEligibility.eligible.length)warnings.push(warning("POSITION_ELIGIBILITY_MISSING","positionEligibility","No supported position eligibility is available."));
  const levelSchemaState=player.prospectLevelSchemaState||null;
  if(levelSchemaState===PROSPECT_LEVEL_SCHEMA_STATES.PARTIAL)throw new Error("Prospect-level evidence schema is partially available.");
  const schemaAbsent=levelSchemaState===PROSPECT_LEVEL_SCHEMA_STATES.SCHEMA_ABSENT;
  const minorKnown=typeof player.is_minor_leaguer==="boolean",isMinorLeaguer=minorKnown?player.is_minor_leaguer:null,currentLevel=schemaAbsent?null:player.current_level??null,levelSource=schemaAbsent?null:player.level_source??null,levelObservedAt=schemaAbsent?null:iso(player.level_observed_at),storedLevelAvailability=schemaAbsent?"":String(player.level_availability||"").toUpperCase(),levelAvailability=schemaAbsent?PROSPECT_LEVEL_SCHEMA_STATES.SCHEMA_ABSENT:storedLevelAvailability||((currentLevel&&currentLevel!==PROSPECT_LEVELS.UNKNOWN)?LEVEL_AVAILABILITY.AVAILABLE:LEVEL_AVAILABILITY.UNKNOWN),levelRawEvidence=schemaAbsent?null:player.level_raw_evidence??null;
  const roleEvidence={mlbStatus:currentLevel===PROSPECT_LEVELS.MLB?"MLB":isMinorLeaguer===true?"MINORS":player.mlb_team?"MLB":"UNKNOWN",rosterStatus:player.roster_status??null,pitcherEligibility:positionEligibility.eligible.filter(item=>item==="SP"||item==="RP"),everydayRole:null,rotationRole:null,bullpenRole:null,savesHoldsOpportunity:null,status:player.roster_status||player.mlb_team||minorKnown||currentLevel?INPUT_AVAILABILITY.AVAILABLE:INPUT_AVAILABILITY.UNAVAILABLE};
  if(!player.roster_status)warnings.push(warning("ROLE_EVIDENCE_INCOMPLETE","role","Role evidence is incomplete; certainty was not inferred."));
  return {schema:"player-intelligence-input-v1",inputVersion:PLAYER_INTELLIGENCE_INPUT_VERSION,playerId:player.id,leagueId:league.id,asOfDate:new Date(asOfDate).toISOString(),season:season??null,
    player:{id:player.id,name:player.name??null,mlbamId:player.mlbam_id??null,fantraxId:player.fantrax_id??null,fantraxApiPlayerId:player.fantrax_api_player_id??null,age:player.age??null,organization:player.mlb_team??null,isMinorLeaguer,rosterStatus:player.roster_status??null,ownerTeamId:player.owner_team_id??null,isFreeAgent:player.is_free_agent??player.owner_team_id===null},
    leagueContext:leagueContext(league,season),positionEligibility,
    production:{status:productionRow?fantraxFreshness.status:INPUT_AVAILABILITY.UNAVAILABLE,fantasyPoints:productionRow?productionRaw.fantasyPoints??null:null,fantasyPointsPerGame:productionRow?productionRaw.fantasyPointsPerGame??null:null,gamesPlayed:null,plateAppearances:raw.pa??null,inningsPitched:null,appearances:null,season:productionRow?.season??season??null,source:productionRow?.source??null,metricRowId:productionRow?.id??null,sourceFilename:productionMetadata.sourceFilename??null,sourceJobId:productionMetadata.sourceJobId??null,rosterStatus:player.roster_status??null,ownerTeamId:player.owner_team_id??null,isFreeAgent:player.is_free_agent??player.owner_team_id===null,warning:productionRow?null:"Authoritative player-level league production is not available."},
    underlyingSkill:{status:statcastFreshness.status,playerType:type,metrics:metricRow?canonicalMetrics(raw,type==="pitcher"?PITCHER_KEYS:HITTER_KEYS):{},metricRowId:metricRow?.id??null,metricType:metricRow?.metric_type??null,source:metricRow?.source??null,season:metricRow?.season??season??null,snapshotId:metadata.snapshotId??null},
    market:{status:hkbAvailable?INPUT_AVAILABILITY.AVAILABLE:INPUT_AVAILABILITY.MISSING,provider:"HKB",value:hkbAvailable?Number(player.hkb_value):null,overallRank:player.overall_rank??null,positionRank:player.position_rank??null},
    role:roleEvidence,ageDevelopment:{status:player.age!==null&&player.age!==undefined?INPUT_AVAILABILITY.AVAILABLE:INPUT_AVAILABILITY.MISSING,age:player.age??null,isMinorLeaguer,organization:player.mlb_team??null,level:currentLevel,levelSource,levelAvailability,levelSchemaState,levelFreshness:levelObservedAt,levelRawEvidence,readiness:null},
    prospectContext:{status:isMinorLeaguer===true?INPUT_AVAILABILITY.AVAILABLE:isMinorLeaguer===false?INPUT_AVAILABILITY.UNAVAILABLE:INPUT_AVAILABILITY.MISSING,isProspect:isMinorLeaguer,level:currentLevel,levelSource,levelAvailability,levelSchemaState,levelFreshness:levelObservedAt,classification:null,rosterSlotUsed:Boolean(player.owner_team_id),readiness:null},replacementContext:{status:INPUT_AVAILABILITY.UNAVAILABLE,frontier:null,advantage:null},
    dataFreshness:{statcast:statcastFreshness,hkb:{status:hkbAvailable?INPUT_AVAILABILITY.UNAVAILABLE:INPUT_AVAILABILITY.MISSING,source:"HKB",season:null,fetchedAt:null,ageMs:null},fantrax:fantraxFreshness},warnings};
}

export async function loadCanonicalPlayerIntelligenceInput({leagueId,playerId,season,asOfDate,repositories={}}={}){
  if(!leagueId||!playerId)throw new Error("League ID and stable player UUID are required.");
  const playersRepo=repositories.players||playerRepository,metricsRepo=repositories.metrics||metricRepository,leaguesRepo=repositories.leagues||leagueRepository;
  const [players,metricRows,league]=await Promise.all([playersRepo.allPlayers(leagueId),metricsRepo.listMetrics(leagueId),leaguesRepo.leagueById(leagueId)]);
  const player=withProspectLevelSchemaState(players||[]).find(row=>row.id===playerId);if(!player)throw new Error("Player UUID was not found in the active league.");
  return buildCanonicalPlayerIntelligenceInput({player,league,metricRows,season,asOfDate});
}
