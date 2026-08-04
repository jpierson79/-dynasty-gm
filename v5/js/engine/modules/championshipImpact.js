import { confidenceAdjust, hasMetric, hkbScore, metricNumber, weightedScore } from "./math.js";
import { stageScore } from "./playerStage.js";

export function championshipImpact({player,metrics={},scarcityScore=50,trendScore=50,stage="UNKNOWN",confidence={overall:.5}}={}){
  const metricType=String(metrics.metric_type||metrics.type||"").toLowerCase();
  const xwoba=metricNumber(metrics,"xwoba",0);
  const xera=metricNumber(metrics,"xera",0);
  const hitterProduction=hasMetric(metrics,"xwoba")?Math.min(92,Math.max(28,(xwoba-.260)*250+48)):null;
  const pitcherProduction=hasMetric(metrics,"xera")?Math.min(92,Math.max(24,86-xera*9)):null;
  const production=metricType.includes("pitch")?(pitcherProduction??hitterProduction??50):(hitterProduction??pitcherProduction??50);
  const ownedBoost=player?.owner_team_id?4:0;
  const raw=weightedScore([
    [hkbScore(player?.hkb_value),.24],
    [production,.30],
    [stageScore(stage,"current"),.22],
    [scarcityScore,.10],
    [trendScore,.10],
    [50+ownedBoost,.04]
  ]);
  return confidenceAdjust(raw,confidence.overall,{neutral:48,maxSwing:44});
}

export default championshipImpact;
