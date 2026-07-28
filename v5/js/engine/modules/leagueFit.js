import { clampScore } from "./math.js";

export function leagueFit({player,leagueSettings={},scarcityScore=50}={}){
  const positions=Array.isArray(player?.positions)?player.positions:[];
  const upper=positions.map(pos=>String(pos).toUpperCase());
  const points=String(leagueSettings?.scoringType||"").toLowerCase().includes("points");
  const starterPremium=points&&upper.includes("SP")?9:0;
  const relieverPremium=(points&&upper.includes("RP")?3:0)+(String(leagueSettings?.savesHolds||leagueSettings?.relieverScoring||"").toLowerCase().includes("hold")?5:0);
  const catcherDiminished=upper.includes("C")?Math.min(10,(scarcityScore-50)*.18):0;
  return clampScore(48+scarcityScore*.20+starterPremium+relieverPremium+catcherDiminished);
}

export default leagueFit;
