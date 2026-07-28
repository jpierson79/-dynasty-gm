import { selectLeagueRows } from "./baseRepository.js";

export async function listTrades(leagueId){
  return selectLeagueRows("trades",leagueId,{order:"transaction_date",ascending:false});
}
export async function listTradeAssets(leagueId){
  return selectLeagueRows("trade_assets",leagueId,{order:"created_at",ascending:false});
}
