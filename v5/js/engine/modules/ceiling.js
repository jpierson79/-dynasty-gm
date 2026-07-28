import { clampScore, confidenceAdjust, hasMetric, hkbScore, metricNumber, weightedScore } from "./math.js";
import { stageScore } from "./playerStage.js";

export function ceiling({player,metrics={},ageCurveScore=50,breakoutProbability=50,stage="UNKNOWN",confidence={overall:.5}}={}){
  const hitterQuality=(hasMetric(metrics,"barrel_batted_rate")?metricNumber(metrics,"barrel_batted_rate",0)*3.2:0)+(hasMetric(metrics,"hard_hit_percent")?metricNumber(metrics,"hard_hit_percent",0)*.75:0)+(hasMetric(metrics,"xwoba")?metricNumber(metrics,"xwoba",0)*95:0);
  const pitcherQuality=(hasMetric(metrics,"xera")?Math.max(0,80-metricNumber(metrics,"xera",4.5)*8):0)+(hasMetric(metrics,"whiff_percent")?metricNumber(metrics,"whiff_percent",0)*.55:0);
  const quality=Math.max(42,Math.min(92,Math.max(hitterQuality,pitcherQuality)));
  const raw=weightedScore([
    [hkbScore(player?.hkb_value),.24],
    [ageCurveScore,.18],
    [breakoutProbability,.22],
    [quality,.18],
    [stageScore(stage,"ceiling"),.18]
  ]);
  return clampScore(confidenceAdjust(raw,confidence.overall,{neutral:52,maxSwing:44}));
}

export default ceiling;
