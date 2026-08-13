import * as cloudCsvImport from "../../../js/services/cloudCsvImportService.js";
import { applyFantraxProductionImport, previewFantraxProductionImport } from "../services/fantraxPlayerProductionImportService.js";

export const importTypes=[
  {key:"fantrax",label:"Fantrax Players / Rosters",accept:".csv,text/csv"},
  {key:"fantraxProduction",label:"Fantrax Player Production",accept:".csv,text/csv"},
  {key:"hkb",label:"HarryKnowsBall",accept:".csv,text/csv"},
  {key:"statcastHitters",label:"Statcast Hitters",accept:".csv,text/csv"},
  {key:"statcastPitchers",label:"Statcast Pitchers",accept:".csv,text/csv"},
  {key:"trades",label:"Trade History",accept:".csv,text/csv"},
  {key:"custom",label:"Manager Intelligence",accept:".json,application/json"}
];

export async function previewImport({step,leagueId,file}){
  if(step==="fantraxProduction")return previewFantraxProductionImport({leagueId,file});
  return cloudCsvImport.previewStep({step,leagueId,file});
}
export async function runImport({step,leagueId,file,onProgress,cancelled,reviewedPreview}){
  if(step==="fantraxProduction")return applyFantraxProductionImport({leagueId,file,reviewedPreview,reviewed:true});
  return cloudCsvImport.runStep({step,leagueId,file,onProgress,cancelled,reviewedPreview});
}
