import * as leagueRepository from "../repositories/leagueRepository.js";
import * as metricRepository from "../repositories/metricRepository.js";
import * as playerRepository from "../repositories/playerRepository.js";
import * as scoreRepository from "../repositories/scoreRepository.js";

const SCORE_KEYS=[
  "dynasty_asset_score","championship_impact","market_appreciation","trade_liquidity",
  "scarcity","ceiling_score","floor_score","risk_score","age_curve_score","trend_score",
  "breakout_probability","buy_low_score","sell_high_score","portfolio_fit","league_fit",
  "acquisition_opportunity","confidence_score","overall_score"
];

function norm(value){
  return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function percentile(values,p){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*p)))];
}
function distribution(rows,key){
  const values=rows.map(row=>Number(row?.explanation?.scores?.[key]??row?.[key])).filter(Number.isFinite);
  const min=values.length?Math.min(...values):null;
  const max=values.length?Math.max(...values):null;
  const avg=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  const variance=values.length?values.reduce((sum,value)=>sum+(value-avg)**2,0)/values.length:null;
  return {
    key,
    min,
    p10:percentile(values,.10),
    median:percentile(values,.50),
    p90:percentile(values,.90),
    max,
    stddev:variance===null?null:Math.round(Math.sqrt(variance)*10)/10,
    nullCount:rows.length-values.length,
    exact0:values.filter(value=>value===0).length,
    exact50:values.filter(value=>value===50).length,
    exact100:values.filter(value=>value===100).length,
    countAtExactMin:values.filter(value=>value===min).length,
    countAtExactMax:values.filter(value=>value===max).length
  };
}
function latestByPlayer(rows){
  const map=new Map();
  rows.forEach(row=>{
    const current=map.get(row.player_id);
    if(!current||String(row.calculated_at||"")>String(current.calculated_at||""))map.set(row.player_id,row);
  });
  return map;
}
function sample(row){
  if(!row)return null;
  return {
    name:row.player.name,
    id:row.player.id,
    age:row.player.age,
    positions:row.player.positions,
    mlb_team:row.player.mlb_team,
    owner_team_id:row.player.owner_team_id,
    roster_status:row.player.roster_status,
    hkb_value:row.player.hkb_value,
    metricTypes:row.metrics.map(metric=>metric.metric_type),
    score_version:row.score?.score_version||"",
    calculated_at:row.score?.calculated_at||"",
    scores:row.score?.explanation?.scores||null,
    metadata:row.score?.explanation?.metadata||null
  };
}
function addGroup(grouped,key,row){
  const score=Number(row.score?.explanation?.scores?.dynasty_asset_score);
  if(!Number.isFinite(score))return;
  if(!grouped[key])grouped[key]={count:0,total:0};
  grouped[key].count+=1;
  grouped[key].total+=score;
}
function finalizeGroups(grouped){
  return Object.fromEntries(Object.entries(grouped).map(([key,value])=>[key,{count:value.count,avg:Math.round(value.total/value.count)}]).sort((a,b)=>b[1].avg-a[1].avg));
}

export function buildScoreDiagnosticsFromRows(leagueId,players=[],metrics=[],scores=[],{version="5.1.1"}={}){
  const currentScores=scores.filter(score=>score.score_version===version);
  const latestScoreByPlayer=latestByPlayer(currentScores);
  const metricsByPlayer=new Map();
  metrics.forEach(metric=>{
    if(!metricsByPlayer.has(metric.player_id))metricsByPlayer.set(metric.player_id,[]);
    metricsByPlayer.get(metric.player_id).push(metric);
  });
  const joined=players.map(player=>({player,score:latestScoreByPlayer.get(player.id)||null,metrics:metricsByPlayer.get(player.id)||[]}));
  const duplicateKeys=new Map();
  currentScores.forEach(score=>{
    const key=`${score.player_id}|${score.score_version}`;
    duplicateKeys.set(key,(duplicateKeys.get(key)||0)+1);
  });
  const malformed=currentScores.filter(score=>!score.calculated_at||score.score_version!==version||!score.explanation?.scores||SCORE_KEYS.some(key=>{
    const value=Number(score.explanation.scores[key]);
    return !Number.isFinite(value)||value<0||value>100;
  }));
  const findName=target=>joined.find(row=>norm(row.player.name).includes(norm(target)));
  const samples={
    "Juan Soto":findName("Juan Soto"),
    "Ronald Acuna Jr.":findName("Ronald Acuna"),
    "Yoshinobu Yamamoto":findName("Yoshinobu Yamamoto"),
    "Nolan McLean":findName("Nolan McLean"),
    "Brice Turang":findName("Brice Turang"),
    "Sal Stewart":findName("Sal Stewart"),
    "Francisco Lindor":findName("Francisco Lindor"),
    "Colt Emerson":findName("Colt Emerson"),
    "Andy Pages":findName("Andy Pages"),
    "Hunter Goodman":findName("Hunter Goodman"),
    "Braden Montgomery":findName("Braden Montgomery"),
    "elite free agent":joined.filter(row=>!row.player.owner_team_id&&row.score).sort((a,b)=>(b.score.explanation?.scores?.dynasty_asset_score||0)-(a.score.explanation?.scores?.dynasty_asset_score||0))[0],
    "replacement-level MLB player":joined.filter(row=>row.player.mlb_team&&Number(row.player.hkb_value||0)>0&&Number(row.player.hkb_value||0)<200&&row.score).sort((a,b)=>(a.score.explanation?.scores?.dynasty_asset_score||0)-(b.score.explanation?.scores?.dynasty_asset_score||0))[0],
    "high-upside prospect":joined.filter(row=>Number(row.player.age||0)<=23&&row.score).sort((a,b)=>(b.score.explanation?.scores?.market_appreciation||0)-(a.score.explanation?.scores?.market_appreciation||0))[0],
    "older veteran":joined.filter(row=>Number(row.player.age||0)>=34&&row.score).sort((a,b)=>(b.score.explanation?.scores?.dynasty_asset_score||0)-(a.score.explanation?.scores?.dynasty_asset_score||0))[0],
    "injured player":joined.find(row=>/IL|INJ|IR/i.test(String(row.player.roster_status||""))),
    "HKB no Statcast":joined.find(row=>Number(row.player.hkb_value||0)>0&&row.metrics.length===0&&row.score),
    "Statcast no HKB":joined.find(row=>!Number(row.player.hkb_value||0)&&row.metrics.length&&row.score),
    "neither HKB nor Statcast":joined.find(row=>!Number(row.player.hkb_value||0)&&!row.metrics.length&&row.score)
  };
  const positionValues={};
  const stageGroups={},ownershipGroups={},confidenceGroups={};
  let confidenceRows=0,trendConfidenceRows=0;
  joined.forEach(row=>{
    const score=Number(row.score?.explanation?.scores?.dynasty_asset_score);
    if(!Number.isFinite(score))return;
    const positions=Array.isArray(row.player.positions)&&row.player.positions.length?row.player.positions:["UNKNOWN"];
    positions.forEach(pos=>{
      const key=String(pos||"UNKNOWN");
      if(!positionValues[key])positionValues[key]=[];
      positionValues[key].push(score);
    });
    addGroup(stageGroups,row.score?.explanation?.metadata?.player_stage||"MISSING_STAGE",row);
    addGroup(ownershipGroups,row.player.owner_team_id?"OWNED":"FREE_AGENT",row);
    const confidence=row.score?.explanation?.metadata?.confidence;
    const confidenceLevel=confidence?.level||"MISSING_CONFIDENCE";
    if(Number.isFinite(Number(confidence?.overall)))confidenceRows+=1;
    if(Number.isFinite(Number(row.score?.explanation?.metadata?.trend?.confidence)))trendConfidenceRows+=1;
    addGroup(confidenceGroups,confidenceLevel,row);
  });
  const positionAverages=Object.fromEntries(Object.entries(positionValues).map(([pos,values])=>[pos,{count:values.length,avg:Math.round(values.reduce((sum,value)=>sum+value,0)/values.length)}]).sort((a,b)=>b[1].avg-a[1].avg));
  return {
    leagueId,
    playerCount:players.length,
    scoreRows:scores.length,
    currentVersionRows:currentScores.length,
    distinctCurrentVersionPlayers:latestScoreByPlayer.size,
    duplicateScoreRows:[...duplicateKeys.values()].filter(count=>count>1).reduce((sum,count)=>sum+count-1,0),
    missingScorePlayers:players.length-latestScoreByPlayer.size,
    malformedScoreRows:malformed.length,
    latestCalculatedAt:currentScores.map(score=>score.calculated_at).sort().at(-1)||null,
    distributions:Object.fromEntries(SCORE_KEYS.map(key=>[key,distribution(currentScores,key)])),
    samples:Object.fromEntries(Object.entries(samples).map(([key,row])=>[key,sample(row)])),
    positionAverages,
    stageAverages:finalizeGroups(stageGroups),
    ownershipAverages:finalizeGroups(ownershipGroups),
    confidenceAverages:finalizeGroups(confidenceGroups),
    confidenceCoverage:{scoreRows:currentScores.length,confidenceRows,trendConfidenceRows}
  };
}

export async function buildLiveScoreDiagnostics(leagueId,{version="5.1.1"}={}){
  const [players,metrics,scores]=await Promise.all([
    playerRepository.allPlayers(leagueId),
    metricRepository.listMetrics(leagueId),
    scoreRepository.listScores(leagueId)
  ]);
  return buildScoreDiagnosticsFromRows(leagueId,players,metrics,scores,{version});
}

export async function buildLiveScoreDiagnosticsForLeagueName(name="Reddit Phanatics",options={}){
  const user=await leagueRepository.currentUser();
  const leagues=await leagueRepository.accessibleLeagues(user?.id);
  const league=leagues.find(item=>item.name===name)||leagues[0];
  if(!league)throw new Error("No accessible cloud league found.");
  return buildLiveScoreDiagnostics(league.id,options);
}
