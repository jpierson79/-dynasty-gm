import { clampScore, confidenceAdjust, hkbScore, weightedScore } from "./math.js";
import { stageScore } from "./playerStage.js";

export function floor({player,riskScore=50,championshipImpact=50,stage="UNKNOWN",confidence={overall:.5}}={}){
  const rosterCertainty=player?.owner_team_id?58:46;
  const raw=weightedScore([
    [hkbScore(player?.hkb_value),.20],
    [championshipImpact,.28],
    [stageScore(stage,"floor"),.24],
    [100-riskScore,.20],
    [rosterCertainty,.08]
  ]);
  return clampScore(confidenceAdjust(raw,confidence.overall,{neutral:42,maxSwing:42}));
}

export default floor;
