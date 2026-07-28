import { client, request } from "./baseRepository.js";
import { scoresForPlayers } from "./scoreRepository.js";
import { ENGINE_VERSION } from "../engine/dynastyEngine.js";

const SCORE_COLUMNS={
  dynasty_asset_score:"dynasty_asset_score",
  championship_impact:"championship_impact",
  risk_score:"risk_score",
  trade_liquidity:"trade_liquidity",
  market_appreciation:"market_appreciation",
  breakout_probability:"breakout_score",
  overall_score:"gm_score"
};
const PLAYER_COLUMNS="id,league_id,name,fantrax_id,mlbam_id,age,positions,mlb_team,owner_team_id,roster_status,is_free_agent,hkb_value,teams:owner_team_id(id,name,abbreviation)";
const SCORE_SELECT=`id,league_id,player_id,score_version,gm_score,breakout_score,championship_impact,scarcity_score,trade_liquidity,market_appreciation,risk_score,dynasty_asset_score,roster_pressure_score,explanation,calculated_at,players!inner(${PLAYER_COLUMNS})`;

function num(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
export function scoreValue(row,key){
  const scores=row.score?.explanation?.scores||row.explanation?.scores||{};
  const score=row.score||row;
  const map={
    dynasty_asset_score:score.dynasty_asset_score,
    overall_score:score.gm_score,
    championship_impact:score.championship_impact,
    ceiling_score:scores.ceiling_score,
    floor_score:scores.floor_score,
    risk_score:score.risk_score,
    confidence_score:scores.confidence_score,
    trade_liquidity:score.trade_liquidity,
    market_appreciation:score.market_appreciation,
    breakout_probability:score.breakout_score,
    buy_low_score:scores.buy_low_score,
    sell_high_score:scores.sell_high_score,
    scarcity:score.scarcity_score??scores.scarcity,
    league_fit:scores.league_fit,
    portfolio_fit:score.roster_pressure_score??scores.portfolio_fit,
    acquisition_opportunity:scores.acquisition_opportunity,
    trend_score:scores.trend_score
  };
  return num(map[key]);
}
export function intelligenceRow(scoreRow){
  const player=scoreRow.players||scoreRow.player||{};
  const score={...scoreRow,players:undefined,player:undefined};
  const metadata=score.explanation?.metadata||{};
  return {
    ...player,
    player,
    score,
    ownerName:player.teams?.name||"",
    scoreVersion:score.score_version||"",
    calculatedAt:score.calculated_at||"",
    playerStage:metadata.player_stage||"UNKNOWN",
    confidenceLevel:metadata.confidence?.level||"Unavailable",
    hasStatcast:Boolean(metadata.confidence?.metricCount),
    scores:score.explanation?.scores||{}
  };
}
export async function latestScoreVersion(leagueId){
  const supabase=await client();
  const result=await request(supabase.from("calculated_player_scores").select("score_version,calculated_at").eq("league_id",leagueId).order("calculated_at",{ascending:false}).limit(1),"latest score version");
  return result.data?.[0]?.score_version||ENGINE_VERSION;
}
function applyPlayerFilters(query,filters={}){
  if(filters.search)query=query.ilike("players.name",`%${filters.search}%`);
  if(filters.position)query=query.contains("players.positions",[filters.position]);
  if(filters.mlbTeam)query=query.eq("players.mlb_team",filters.mlbTeam);
  if(filters.ownerTeamId)query=filters.ownerTeamId==="FREE_AGENT"?query.is("players.owner_team_id",null):query.eq("players.owner_team_id",filters.ownerTeamId);
  if(filters.freeAgentsOnly)query=query.is("players.owner_team_id",null);
  if(filters.rosteredOnly)query=query.not("players.owner_team_id","is",null);
  if(filters.rosterStatus)query=query.eq("players.roster_status",filters.rosterStatus);
  if(filters.hasHkb)query=query.not("players.hkb_value","is",null);
  if(filters.hasMlbam)query=query.not("players.mlbam_id","is",null);
  if(filters.missingMlbam)query=query.is("players.mlbam_id",null);
  return query;
}
function applyScoreFilters(query,filters={}){
  if(filters.minDynastyAssetScore)query=query.gte("dynasty_asset_score",Number(filters.minDynastyAssetScore));
  if(filters.minChampionshipImpact)query=query.gte("championship_impact",Number(filters.minChampionshipImpact));
  if(filters.maxRisk)query=query.lte("risk_score",Number(filters.maxRisk));
  return query;
}
function localFilterRows(rows,filters={}){
  return rows.filter(row=>{
    if(filters.playerStage&&row.playerStage!==filters.playerStage)return false;
    if(filters.dataAvailability==="highConfidence"&&scoreValue(row,"confidence_score")<70)return false;
    if(filters.dataAvailability==="lowConfidence"&&scoreValue(row,"confidence_score")>=55)return false;
    if(filters.dataAvailability==="hasStatcast"&&!row.hasStatcast)return false;
    if(filters.dataAvailability==="hasHkb"&&!Number.isFinite(Number(row.hkb_value)))return false;
    if(filters.dataAvailability==="hasMlbam"&&!row.mlbam_id)return false;
    if(filters.dataAvailability==="missingMlbam"&&row.mlbam_id)return false;
    if(filters.minCeiling&&scoreValue(row,"ceiling_score")<Number(filters.minCeiling))return false;
    if(filters.minConfidence&&scoreValue(row,"confidence_score")<Number(filters.minConfidence))return false;
    if(filters.minBreakoutProbability&&scoreValue(row,"breakout_probability")<Number(filters.minBreakoutProbability))return false;
    if(filters.minBuyLowScore&&scoreValue(row,"buy_low_score")<Number(filters.minBuyLowScore))return false;
    if(filters.minAcquisitionOpportunity&&scoreValue(row,"acquisition_opportunity")<Number(filters.minAcquisitionOpportunity))return false;
    return true;
  });
}
function sortRows(rows,sort,ascending){
  if(SCORE_COLUMNS[sort])return rows;
  return rows.slice().sort((a,b)=>{
    const av=scoreValue(a,sort),bv=scoreValue(b,sort);
    if(av!==null&&bv!==null&&av!==bv)return ascending?av-bv:bv-av;
    return String(a.id).localeCompare(String(b.id));
  });
}
export async function listPlayerIntelligence(leagueId,query={}){
  const page=Number(query.page)||1,pageSize=Number(query.pageSize)||50;
  const version=query.scoreVersion||await latestScoreVersion(leagueId);
  const supabase=await client();
  let dbQuery=supabase.from("calculated_player_scores").select(SCORE_SELECT,{count:"exact"}).eq("league_id",leagueId).eq("score_version",version);
  dbQuery=applyPlayerFilters(dbQuery,query);
  dbQuery=applyScoreFilters(dbQuery,query);
  const sort=query.sort||"dynasty_asset_score";
  const ascending=query.ascending===true||query.ascending==="true";
  if(SCORE_COLUMNS[sort])dbQuery=dbQuery.order(SCORE_COLUMNS[sort],{ascending});
  else if(sort==="name")dbQuery=dbQuery.order("name",{referencedTable:"players",ascending});
  else if(sort==="hkb_value")dbQuery=dbQuery.order("hkb_value",{referencedTable:"players",ascending});
  else dbQuery=dbQuery.order("dynasty_asset_score",{ascending:false});
  dbQuery=dbQuery.order("player_id",{ascending:true}).range((page-1)*pageSize,page*pageSize-1);
  const result=await request(dbQuery,"player intelligence paged query");
  const rows=sortRows(localFilterRows((result.data||[]).map(intelligenceRow),query),sort,ascending);
  return {rows,count:result.count||0,page,pageSize,scoreVersion:version};
}
export async function playerIntelligenceByIds(leagueId,playerIds,scoreVersion){
  if(!playerIds.length)return [];
  const scoreRows=await scoresForPlayers(leagueId,playerIds);
  const version=scoreVersion||scoreRows[0]?.score_version||ENGINE_VERSION;
  const supabase=await client();
  const playersResult=await request(supabase.from("players").select(`${PLAYER_COLUMNS}`).eq("league_id",leagueId).in("id",playerIds),"player comparison query");
  const playerById=new Map((playersResult.data||[]).map(player=>[player.id,player]));
  return playerIds.map(playerId=>{
    const score=scoreRows.find(row=>row.player_id===playerId&&row.score_version===version)||scoreRows.find(row=>row.player_id===playerId)||null;
    return intelligenceRow({...(score||{player_id:playerId,score_version:version,explanation:{scores:{},metadata:{}}}),players:playerById.get(playerId)||{id:playerId}});
  });
}
