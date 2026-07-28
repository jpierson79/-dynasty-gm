import { clampScore, hasMetric, metricNumber, weightedScore } from "./math.js";

export function trendScore({metrics={}}={}){
  return trendDetails({metrics}).score;
}

export function trendDetails({metrics={}}={}){
  if(!metrics||!Object.keys(metrics).length)return {score:50,status:"INSUFFICIENT_DATA",confidence:0,source:"none"};
  const metricType=String(metrics.metric_type||metrics.type||"").toLowerCase();
  const hitterSignals=[];
  if(hasMetric(metrics,"xwoba"))hitterSignals.push((metricNumber(metrics,"xwoba",.315)-.315)*220+50);
  if(hasMetric(metrics,"hard_hit_percent"))hitterSignals.push((metricNumber(metrics,"hard_hit_percent",40)-40)*.9+50);
  if(hasMetric(metrics,"barrel_batted_rate"))hitterSignals.push((metricNumber(metrics,"barrel_batted_rate",8)-8)*2.2+50);
  const pitcherSignals=[];
  if(hasMetric(metrics,"xera"))pitcherSignals.push((4.2-metricNumber(metrics,"xera",4.2))*9+50);
  if(hasMetric(metrics,"whiff_percent"))pitcherSignals.push((metricNumber(metrics,"whiff_percent",24)-24)*.95+50);
  if(hasMetric(metrics,"k_percent"))pitcherSignals.push((metricNumber(metrics,"k_percent",22)-22)*1.1+50);
  const usePitcher=metricType.includes("pitch")||(!metricType.includes("hit")&&pitcherSignals.length>hitterSignals.length);
  const signals=usePitcher?pitcherSignals:hitterSignals;
  if(!signals.length)return {score:50,status:"INSUFFICIENT_DATA",confidence:0,source:"none"};
  const score=clampScore(weightedScore(signals.map(value=>[value,1])));
  const status=score>=57?"IMPROVING":score<=43?"DECLINING":"STABLE";
  return {score,status,confidence:Math.min(1,signals.length/3),source:usePitcher?"pitcher":"hitter"};
}

export function buyLowScore({dynastyAssetScore=50,marketAppreciation=50,riskScore=50}={}){
  return clampScore((100-dynastyAssetScore)*0.35+marketAppreciation*0.45+(100-riskScore)*0.20);
}

export function sellHighScore({dynastyAssetScore=50,marketAppreciation=50,riskScore=50}={}){
  return clampScore(dynastyAssetScore*0.45+(100-marketAppreciation)*0.25+riskScore*0.30);
}

export function overallScore(scores={}){
  // V5.1.1 balanced composite: long-term asset quality matters most, with current impact,
  // market, liquidity, upside, floor, fit, and risk all contributing without any single source dominating.
  return clampScore(
    (scores.dynasty_asset_score||0)*0.20+
    (scores.championship_impact||0)*0.14+
    (scores.market_appreciation||0)*0.12+
    (scores.trade_liquidity||0)*0.09+
    (scores.scarcity||0)*0.08+
    (scores.ceiling_score||0)*0.10+
    (scores.floor_score||0)*0.07+
    (100-(scores.risk_score||0))*0.08+
    (scores.age_curve_score||0)*0.05+
    (scores.breakout_probability||0)*0.05+
    (scores.league_fit||0)*0.02
  );
}

export default overallScore;
