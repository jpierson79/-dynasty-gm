import { clampScore, numberValue } from "./math.js";

export function risk({player,metrics={}}={}){
  const age=numberValue(player?.age,0);
  const ageRisk=age>32?(age-32)*8:age&&age<22?12:0;
  const missingMetrics=metrics&&Object.keys(metrics).length?0:18;
  const missingIds=player?.fantrax_id||player?.mlbam_id?0:16;
  const rosterUncertainty=String(player?.roster_status||"").toUpperCase()==="UNCLASSIFIED"?10:0;
  const freeAgentRisk=!player?.owner_team_id||String(player?.roster_status||"").toUpperCase()==="FREE_AGENT"?6:0;
  return clampScore(26+ageRisk+missingMetrics+missingIds+rosterUncertainty+freeAgentRisk);
}

export default risk;
