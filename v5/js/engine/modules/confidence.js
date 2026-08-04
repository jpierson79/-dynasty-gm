import { clampNumber, clampScore, hasMetric, numberValue } from "./math.js";
import { PLAYER_STAGES } from "./playerStage.js";

export function sourceConfidence({player,metrics={},stage=PLAYER_STAGES.UNKNOWN}={}){
  const hasHkb=numberValue(player?.hkb_value,0)>0;
  const hasStableId=Boolean(player?.fantrax_id||player?.mlbam_id);
  const hasRoster=Boolean(player?.owner_team_id||player?.roster_status);
  const metricKeys=["xwoba","xera","hard_hit_percent","barrel_batted_rate","whiff_percent","k_percent","bb_percent"];
  const metricCount=metricKeys.filter(key=>hasMetric(metrics,key)).length;
  const stageBonus={
    MLB_ESTABLISHED:.12,
    MLB_EMERGING:.10,
    MLB_ROLE_PLAYER:.04,
    PROSPECT_NEAR_MLB:.02,
    PROSPECT_DEVELOPMENTAL:-.04,
    RELIEVER:.02,
    UNKNOWN:-.08
  }[stage]||0;
  const value=.30+(hasStableId?.14:0)+(hasHkb?.18:0)+Math.min(.24,metricCount*.045)+(hasRoster?.04:0)+stageBonus;
  return {
    overall:clampNumber(value,.18,.96),
    hasHkb,
    hasStableId,
    hasRoster,
    metricCount,
    level:value>=.72?"HIGH":value>=.48?"MEDIUM":"LOW"
  };
}

export function confidenceScore(confidence){
  return clampScore((confidence?.overall||0)*100);
}

export default sourceConfidence;
