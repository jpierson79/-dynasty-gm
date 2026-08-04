import * as leagueRepository from "../repositories/leagueRepository.js";
import * as metricRepository from "../repositories/metricRepository.js";
import * as playerRepository from "../repositories/playerRepository.js";
import * as scoreRepository from "../repositories/scoreRepository.js";
import { ageCurveScore } from "./modules/ageCurve.js";
import { breakout } from "./modules/breakout.js";
import { ceiling } from "./modules/ceiling.js";
import { championshipImpact } from "./modules/championshipImpact.js";
import { sourceConfidence, confidenceScore } from "./modules/confidence.js";
import { floor } from "./modules/floor.js";
import { leagueFit } from "./modules/leagueFit.js";
import { marketAppreciation } from "./modules/marketAppreciation.js";
import { hkbScore, weightedScore, clampScore } from "./modules/math.js";
import { overallScore, buyLowScore, sellHighScore, trendDetails } from "./modules/overallScore.js";
import { classifyPlayerStage } from "./modules/playerStage.js";
import { portfolioFit } from "./modules/portfolioFit.js";
import { risk } from "./modules/risk.js";
import { scarcity } from "./modules/scarcity.js";
import { tradeLiquidity } from "./modules/tradeLiquidity.js";

export const ENGINE_VERSION="5.1.1";
export const ENGINE_BATCH_SIZE=200;

function nowIso(){return new Date().toISOString()}
function assertNotCancelled(cancelled){
  if(cancelled?.()){
    const error=new Error("Dynasty Intelligence Engine cancelled.");
    error.cancelled=true;
    throw error;
  }
}
function latestMetricsByPlayer(metricRows=[]){
  const map=new Map();
  metricRows.forEach(row=>{
    const current=map.get(row.player_id);
    const currentTime=String(current?.imported_at||current?.created_at||"");
    const rowTime=String(row.imported_at||row.created_at||"");
    if(!current||rowTime>=currentTime)map.set(row.player_id,row);
  });
  return map;
}
function metricPayload(metricRow){
  const payload=metricRow?.metrics&&typeof metricRow.metrics==="object"?metricRow.metrics:{};
  return metricRow?.metric_type?{...payload,metric_type:metricRow.metric_type}:payload;
}
function acquisitionOpportunity({player,riskScore=50,marketAppreciation=50,confidence={overall:.5}}={}){
  const isFreeAgent=!player?.owner_team_id||String(player?.roster_status||"").toUpperCase()==="FREE_AGENT";
  const base=isFreeAgent?72:28;
  const raw=weightedScore([
    [base,.38],
    [marketAppreciation,.26],
    [hkbScore(player?.hkb_value),.18],
    [100-riskScore,.12],
    [confidenceScore(confidence),.06]
  ]);
  return clampScore(raw);
}
export function calculatePlayerScores({player,metrics={},leagueSettings={}}){
  const player_stage=classifyPlayerStage({player,metrics});
  const confidence=sourceConfidence({player,metrics,stage:player_stage});
  const age_curve_score=ageCurveScore({player});
  const trend=trendDetails({metrics});
  const trend_score=trend.score;
  const scarcity_score=scarcity({player});
  const breakout_probability=breakout({player,metrics,ageCurveScore:age_curve_score,stage:player_stage});
  const championship_impact=championshipImpact({player,metrics,scarcityScore:scarcity_score,trendScore:trend_score,stage:player_stage,confidence});
  const risk_score=risk({player,metrics});
  const market_appreciation=marketAppreciation({player,ageCurveScore:age_curve_score,trendScore:trend_score,breakoutProbability:breakout_probability,stage:player_stage});
  const trade_liquidity=tradeLiquidity({player,championshipImpact:championship_impact,riskScore:risk_score,stage:player_stage,confidence});
  const ceiling_score=ceiling({player,metrics,ageCurveScore:age_curve_score,breakoutProbability:breakout_probability,stage:player_stage,confidence});
  const floor_score=floor({player,riskScore:risk_score,championshipImpact:championship_impact,stage:player_stage,confidence});
  const acquisition_opportunity=acquisitionOpportunity({player,riskScore:risk_score,marketAppreciation:market_appreciation,confidence});
  const portfolio_fit=portfolioFit({player,leagueSettings,scarcityScore:scarcity_score,ageCurveScore:age_curve_score,acquisitionOpportunity:acquisition_opportunity});
  const league_fit=leagueFit({player,leagueSettings,scarcityScore:scarcity_score});
  const dynasty_asset_score=clampScore(weightedScore([
    [ceiling_score,.20],
    [floor_score,.14],
    [market_appreciation,.16],
    [championship_impact,.15],
    [hkbScore(player?.hkb_value),.13],
    [100-risk_score,.10],
    [breakout_probability,.08],
    [age_curve_score,.04]
  ]));
  const buy_low_score=buyLowScore({dynastyAssetScore:dynasty_asset_score,marketAppreciation:market_appreciation,riskScore:risk_score});
  const sell_high_score=sellHighScore({dynastyAssetScore:dynasty_asset_score,marketAppreciation:market_appreciation,riskScore:risk_score});
  const overall_score=overallScore({
    dynasty_asset_score,
    championship_impact,
    market_appreciation,
    trade_liquidity,
    scarcity:scarcity_score,
    ceiling_score,
    floor_score,
    risk_score,
    age_curve_score,
    breakout_probability,
    league_fit
  });
  return {
    dynasty_asset_score,
    championship_impact,
    market_appreciation,
    trade_liquidity,
    scarcity:scarcity_score,
    ceiling_score,
    floor_score,
    risk_score,
    age_curve_score,
    trend_score,
    breakout_probability,
    buy_low_score,
    sell_high_score,
    portfolio_fit,
    league_fit,
    acquisition_opportunity,
    confidence_score:confidenceScore(confidence),
    overall_score,
    overall_score_version:ENGINE_VERSION,
    metadata:{
      player_stage,
      confidence,
      trend:{status:trend.status,confidence:trend.confidence,source:trend.source},
      weights:{
        dynasty_asset_score:{ceiling_score:.20,floor_score:.14,market_appreciation:.16,championship_impact:.15,hkb_talent:.13,risk_inverse:.10,breakout_probability:.08,age_curve_score:.04},
        overall_score:{dynasty_asset_score:.20,championship_impact:.14,market_appreciation:.12,trade_liquidity:.09,scarcity:.08,ceiling_score:.10,floor_score:.07,risk_inverse:.08,age_curve_score:.05,breakout_probability:.05,league_fit:.02}
      }
    }
  };
}
export function scoreRow({leagueId,player,scores,calculatedAt=nowIso()}){
  const {metadata,...scoreValues}=scores;
  return {
    league_id:leagueId,
    player_id:player.id,
    score_version:ENGINE_VERSION,
    gm_score:scores.overall_score,
    breakout_score:scores.breakout_probability,
    championship_impact:scores.championship_impact,
    scarcity_score:scores.scarcity,
    trade_liquidity:scores.trade_liquidity,
    market_appreciation:scores.market_appreciation,
    risk_score:scores.risk_score,
    dynasty_asset_score:scores.dynasty_asset_score,
    roster_pressure_score:scores.portfolio_fit,
    explanation:{engineVersion:ENGINE_VERSION,overallScoreVersion:ENGINE_VERSION,scores:scoreValues,metadata},
    calculated_at:calculatedAt
  };
}
export async function calculateLeagueScores(leagueId,options={}){
  if(!leagueId)throw new Error("Active league is required.");
  const repositories=options.repositories||{};
  const playersRepo=repositories.players||playerRepository;
  const metricsRepo=repositories.metrics||metricRepository;
  const scoresRepo=repositories.scores||scoreRepository;
  const leaguesRepo=repositories.leagues||leagueRepository;
  const batchSize=options.batchSize||ENGINE_BATCH_SIZE;
  const onProgress=options.onProgress||(()=>{});
  const cancelled=options.cancelled||(()=>false);
  const startedAt=Date.now();
  assertNotCancelled(cancelled);
  const [playerRows,metricRows,league]=await Promise.all([
    playersRepo.allPlayers(leagueId),
    metricsRepo.listMetrics(leagueId),
    leaguesRepo.leagueById?leaguesRepo.leagueById(leagueId):Promise.resolve(null)
  ]);
  const leagueSettings={...(league?.settings||{}),...(options.leagueSettings||{})};
  const metricByPlayer=latestMetricsByPlayer(metricRows);
  let processed=0,upserted=0;
  const skipped=[],failed=[];
  onProgress({stage:"load",processed,total:playerRows.length,upserted,skipped:0,failed:0,engineVersion:ENGINE_VERSION});
  for(let i=0;i<playerRows.length;i+=batchSize){
    assertNotCancelled(cancelled);
    const batch=playerRows.slice(i,i+batchSize);
    const calculatedAt=nowIso();
    const rows=batch.map(player=>{
      try{
        if(!player?.id){
          skipped.push({playerId:"",name:player?.name||"",reason:"Missing player UUID"});
          return null;
        }
        const metrics=metricPayload(metricByPlayer.get(player.id));
        const scores=calculatePlayerScores({player,metrics,leagueSettings});
        return scoreRow({leagueId,player,scores,calculatedAt});
      }catch(error){
        failed.push({playerId:player?.id||"",name:player?.name||"",error:String(error?.message||error)});
        return null;
      }
    }).filter(Boolean);
    const saved=await scoresRepo.upsertScores(rows);
    upserted+=saved.length;
    processed+=batch.length;
    onProgress({stage:"batch",processed,total:playerRows.length,upserted,skipped:skipped.length,failed:failed.length,engineVersion:ENGINE_VERSION,batch:Math.ceil(processed/batchSize)});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  onProgress({stage:"complete",processed,total:playerRows.length,upserted,skipped:skipped.length,failed:failed.length,engineVersion:ENGINE_VERSION});
  return {processed,total:playerRows.length,updated:upserted,upserted,skipped,failed,elapsedMs:Date.now()-startedAt,scoreVersion:ENGINE_VERSION,engineVersion:ENGINE_VERSION,retryable:true};
}
