import { clampScore } from "./math.js";

export function portfolioFit({player,leagueSettings={},scarcityScore=50,ageCurveScore=50,acquisitionOpportunity=50}={}){
  const preferredWindow=leagueSettings?.competitiveWindow||leagueSettings?.window||"balanced";
  const youthFit=preferredWindow==="rebuild"?ageCurveScore:50;
  const contenderFit=preferredWindow==="contend"&&player?.owner_team_id?65:50;
  const opportunityFit=!player?.owner_team_id?acquisitionOpportunity:50;
  return clampScore(scarcityScore*0.28+youthFit*0.25+contenderFit*0.30+opportunityFit*0.17);
}

export default portfolioFit;
