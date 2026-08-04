import { table } from "../components/table.js";
import { number, percent } from "../utils/format.js";

export function renderDashboard(state,overview={metrics:[],scores:[]}){
  const stats=state.dashboardStats||overview.dashboardStats||{};
  const totalPlayers=stats.playerCount||0;
  return `<section class="view-panel"><h2>Dashboard</h2><div class="grid">
    <div class="metric"><span>Active league</span><b>${state.activeLeague?.name||"Select league"}</b></div>
    <div class="metric"><span>Total players</span><b>${number(totalPlayers)}</b></div>
    <div class="metric"><span>Owned players</span><b>${number(stats.ownedPlayers)}</b></div>
    <div class="metric"><span>Free agents</span><b>${number(stats.freeAgents)}</b></div>
    <div class="metric"><span>Teams</span><b>${number(stats.teamCount)}</b></div>
    <div class="metric"><span>Managers</span><b>${number(stats.managerCount)}</b></div>
    <div class="metric"><span>Fantrax IDs</span><b>${number(stats.fantraxIdCount)}</b></div>
    <div class="metric"><span>MLBAM IDs</span><b>${number(stats.mlbamIdCount)}</b></div>
    <div class="metric"><span>Both external IDs</span><b>${number(stats.bothExternalIdCount)}</b></div>
    <div class="metric"><span>No external IDs</span><b>${number(stats.neitherExternalId)}</b></div>
    <div class="metric"><span>HKB coverage</span><b>${percent(stats.hkbCoverage,totalPlayers)}</b></div>
    <div class="metric"><span>Hitter Statcast</span><b>${percent(stats.hitterStatcastCoverage,totalPlayers)}</b></div>
    <div class="metric"><span>Pitcher Statcast</span><b>${percent(stats.pitcherStatcastCoverage,totalPlayers)}</b></div>
    <div class="metric"><span>Score coverage</span><b>${percent(stats.scoreCoverage,totalPlayers)}</b></div>
  </div><p class="note">Player ID is the app record UUID. Fantrax ID and MLBAM ID are external identities.</p><h3>Latest import jobs</h3>${table([
    {label:"Type",value:"import_type"},
    {label:"Status",value:"status"},
    {label:"Processed",value:"rows_processed"},
    {label:"Matched",value:"rows_matched"},
    {label:"Unmatched",value:"rows_unmatched"}
  ],state.latestImportJobs||[])}</section>`;
}
