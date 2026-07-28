import { calculateLeagueScores, ENGINE_VERSION } from "./dynastyEngine.js";

const BATCH_SIZE=200;

export async function recalculateLeagueScores(leagueId,{onProgress=()=>{}}={}){
  return calculateLeagueScores(leagueId,{onProgress,batchSize:BATCH_SIZE});
}

export { ENGINE_VERSION };
