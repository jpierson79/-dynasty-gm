import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
const authUi=await readFile(new URL("../js/services/authUi.js",import.meta.url),"utf8");
const cloudStore=await readFile(new URL("../js/services/cloudStore.js",import.meta.url),"utf8");

assert.match(html,/<h2>Cloud Data Administration<\/h2>/);
assert.match(html,/id="cloudResetPreviewButton"/);
assert.match(html,/id="cloudResetRunButton"[^>]*disabled/);
["cloudResetPlayers","cloudResetTrades","cloudResetTeams","cloudResetManagers","cloudResetImportJobs"].forEach(id=>assert.match(html,new RegExp(`id="${id}"[^>]*checked`)));

assert.match(cloudStore,/const RESET_TABLE_ORDER=\["calculated_player_scores","player_metrics","player_snapshots","manager_preferences","trade_assets","trades","players","teams","managers","import_jobs"\]/);
assert.match(cloudStore,/async function requireLeagueOwner\(leagueId\)/);
assert.match(cloudStore,/league\.owner_user_id!==user\.id/);
assert.match(cloudStore,/export async function previewImportedDataReset/);
assert.match(cloudStore,/export async function resetImportedCloudData/);
assert.match(cloudStore,/String\(confirmationName\|\|""\)\.trim\(\)!==String\(league\.name\|\|""\)\.trim\(\)/);
assert.match(cloudStore,/supabase\.from\(table\)\.delete\(\)\.eq\("league_id",leagueId\)/);
assert.doesNotMatch(cloudStore,/service[-_ ]role/i);

assert.match(authUi,/function previewCloudReset\(\)/);
assert.match(authUi,/function runCloudReset\(\)/);
assert.match(authUi,/window\.confirm\(`Reset imported cloud data/);
assert.match(authUi,/league\.owner_user_id===state\.session\.user\.id/);
assert.match(authUi,/\$\("cloudResetPreviewButton"\)\?\.addEventListener\("click",previewCloudReset\)/);
assert.match(authUi,/\$\("cloudResetRunButton"\)\?\.addEventListener\("click",runCloudReset\)/);

console.log("cloudResetWorkflow tests passed");
