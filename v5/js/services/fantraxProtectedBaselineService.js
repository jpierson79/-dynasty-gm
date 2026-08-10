import { allPlayers } from "../repositories/playerRepository.js?v5-4-6b2-reviewed-sync";
import { allTeams } from "../repositories/teamRepository.js?v5-4-6a-team-identity";
import { listManagers } from "../repositories/managerRepository.js";
import { listMetrics } from "../repositories/metricRepository.js";
import { listScores } from "../repositories/scoreRepository.js";
import { listFantraxSyncAttempts } from "../repositories/fantraxSyncAuditRepository.js?v5-4-6e-opt-in";
import { gate4EvidenceDigest } from "./fantraxGate4AcceptanceHarness.js";

const project=(rows,omit=[])=>rows.map(row=>Object.fromEntries(Object.entries(row||{}).filter(([field])=>!omit.includes(field)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
async function evidence(rows,omit=[]){return {count:rows.length,digest:await gate4EvidenceDigest(project(rows,omit))}}

export async function captureFantraxProtectedBaseline(leagueId,{dependencies={}}={}){
  if(!leagueId)throw new Error("Active league is required for protected-field capture.");
  const d={allPlayers,allTeams,listManagers,listMetrics,listScores,listFantraxSyncAttempts,...dependencies};
  const [players,teams,managers,metrics,scores,attempts]=await Promise.all([d.allPlayers(leagueId),d.allTeams(leagueId),d.listManagers(leagueId),d.listMetrics(leagueId),d.listScores(leagueId),d.listFantraxSyncAttempts(leagueId)]);
  const items=attempts.flatMap(attempt=>attempt.fantrax_sync_attempt_items||[]);
  return {
    players:await evidence(players,["roster_status","roster_status_source","roster_status_synced_at","updated_at"]),
    teams:await evidence(teams),
    managers:await evidence(managers),
    metrics:await evidence(metrics),
    scores:await evidence(scores),
    auditAttempts:await evidence(attempts,["fantrax_sync_attempt_items"]),
    auditItems:await evidence(items)
  };
}
