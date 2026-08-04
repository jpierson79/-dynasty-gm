import { clampScore, hasMetric, hkbScore, metricNumber, numberValue, weightedScore } from "./math.js";
import { PLAYER_STAGES } from "./playerStage.js";

export function breakout({player,metrics={},ageCurveScore=50,stage="UNKNOWN"}={}){
  const age=numberValue(player?.age,0);
  const youngScore=age&&age<=23?82:age<=26?76:age<=29?58:38;
  const quality=(hasMetric(metrics,"barrel_batted_rate")?metricNumber(metrics,"barrel_batted_rate",0)*2.5:0)+(hasMetric(metrics,"hard_hit_percent")?metricNumber(metrics,"hard_hit_percent",0)*.55:0)+(hasMetric(metrics,"xwoba")?metricNumber(metrics,"xwoba",0)*80:0)+(hasMetric(metrics,"whiff_percent")?metricNumber(metrics,"whiff_percent",0)*.3:0);
  const stageUpside={
    [PLAYER_STAGES.MLB_ESTABLISHED]:50,
    [PLAYER_STAGES.MLB_EMERGING]:76,
    [PLAYER_STAGES.MLB_ROLE_PLAYER]:44,
    [PLAYER_STAGES.PROSPECT_NEAR_MLB]:78,
    [PLAYER_STAGES.PROSPECT_DEVELOPMENTAL]:62,
    [PLAYER_STAGES.RELIEVER]:42,
    [PLAYER_STAGES.UNKNOWN]:38
  }[stage]||45;
  return clampScore(weightedScore([
    [youngScore,.24],
    [ageCurveScore,.18],
    [Math.max(35,Math.min(90,quality)),.24],
    [hkbScore(player?.hkb_value),.16],
    [stageUpside,.18]
  ]));
}

export default breakout;
