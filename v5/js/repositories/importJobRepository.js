import { selectLeagueRows } from "./baseRepository.js";

export async function latestImportJobs(leagueId){
  return selectLeagueRows("import_jobs",leagueId,{order:"started_at",ascending:false});
}
