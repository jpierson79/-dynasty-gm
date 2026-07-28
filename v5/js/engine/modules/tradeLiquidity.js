import { clampScore, confidenceAdjust, hkbScore, weightedScore } from "./math.js";
import { stageScore } from "./playerStage.js";

export function tradeLiquidity({player,championshipImpact=50,riskScore=50,stage="UNKNOWN",confidence={overall:.5}}={}){
  const isFreeAgent=!player?.owner_team_id||String(player?.roster_status||"").toUpperCase()==="FREE_AGENT";
  const identityBoost=player?.fantrax_id||player?.mlbam_id?4:0;
  const raw=weightedScore([
    [hkbScore(player?.hkb_value),.24],
    [championshipImpact,.26],
    [stageScore(stage,"liquidity"),.22],
    [100-riskScore,.18],
    [50+identityBoost,.10]
  ]);
  const adjusted=confidenceAdjust(raw,confidence.overall,{neutral:46,maxSwing:42});
  return clampScore(isFreeAgent?adjusted*.72+14:adjusted);
}

export default tradeLiquidity;
