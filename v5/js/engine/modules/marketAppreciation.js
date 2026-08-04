import { clampScore, hkbScore, numberValue, weightedScore } from "./math.js";
import { PLAYER_STAGES } from "./playerStage.js";

export function marketAppreciation({player,ageCurveScore=50,trendScore=50,breakoutProbability=50,stage="UNKNOWN"}={}){
  const hkb=numberValue(player?.hkb_value,0);
  const marketStage={
    [PLAYER_STAGES.MLB_ESTABLISHED]:56,
    [PLAYER_STAGES.MLB_EMERGING]:72,
    [PLAYER_STAGES.MLB_ROLE_PLAYER]:42,
    [PLAYER_STAGES.PROSPECT_NEAR_MLB]:78,
    [PLAYER_STAGES.PROSPECT_DEVELOPMENTAL]:62,
    [PLAYER_STAGES.RELIEVER]:36,
    [PLAYER_STAGES.UNKNOWN]:44
  }[stage]||50;
  const valueGap=Math.max(0,65-hkbScore(hkb));
  return clampScore(weightedScore([
    [ageCurveScore,.22],
    [trendScore,.22],
    [breakoutProbability,.28],
    [marketStage,.18],
    [50+valueGap*.65,.10]
  ]));
}

export default marketAppreciation;
