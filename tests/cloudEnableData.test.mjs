import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app=await readFile(new URL("../js/app.js",import.meta.url),"utf8");
const authUi=await readFile(new URL("../js/services/authUi.js",import.meta.url),"utf8");
const cloudMigration=await readFile(new URL("../js/services/cloudMigrationService.js",import.meta.url),"utf8");

assert.match(app,/let db=loadDB\(\);window\.db=db;BOOTSTRAPPING=false/);
assert.match(app,/function setRuntimeDB\(nextDb,opts=\{\}\)\{db=finalizeLoadedDB\(nextDb\|\|\{\}\);window\.db=db;if\(opts\.saveLocal\)saveDB\(false\);if\(opts\.renderAfter\)render\(\);return db\}/);
assert.match(app,/window\.saveDB=saveDB;window\.setRuntimeDB=setRuntimeDB;window\.loadLocalDB=loadDB/);

assert.match(cloudMigration,/const ACTIVE_LEAGUE_KEY="dynasty_active_league_id"/);
assert.match(cloudMigration,/localStorage\.getItem\(ACTIVE_LEAGUE_KEY\)/);
assert.match(cloudMigration,/localStorage\.setItem\(ACTIVE_LEAGUE_KEY,leagueId\)/);

assert.match(authUi,/const dataMode=\{\s*mode:"local",\s*authenticated:false,\s*leagueId:null,\s*leagueName:null,\s*cloudAvailable:false,\s*message:"Local mode"\s*\}/);
assert.match(authUi,/function cloudModeLabel\(\)/);
assert.match(authUi,/Cloud connected · Select league/);
assert.match(authUi,/Cloud unavailable · Local fallback/);
assert.match(authUi,/if\(dataMode\.mode==="cloud"\)return dataMode\.leagueName\?`Cloud · \$\{dataMode\.leagueName\}`:"Cloud mode"/);

assert.match(authUi,/async function refreshCloudLeagueState\(\)/);
assert.match(authUi,/migrationState\.leagues=await cloudMigration\.cloudStore\.getOwnedLeagues\(\)/);
assert.match(authUi,/migrationState\.selectedLeague=selectAccessibleCloudLeague\(migrationState\.leagues,selectedId\)/);
assert.match(authUi,/function selectAccessibleCloudLeague\(leagues,selectedId\)/);
assert.match(authUi,/if\(accessible\.length===1\)return accessible\[0\]/);
assert.match(authUi,/return accessible\.find\(league=>league\.id===selectedId\)\|\|null/);
assert.match(authUi,/await maybeActivateCloudMode\("Cloud mode activated\."\)/);

assert.match(authUi,/async function verifyCloudRuntimeAccess\(leagueId\)/);
assert.match(authUi,/cloudMigration\.cloudStore\.getCurrentUser\(\)/);
assert.match(authUi,/cloudMigration\.cloudStore\.getLeague\(leagueId\)/);
assert.match(authUi,/cloudMigration\.cloudStore\.getLeagueCounts\(leagueId\)/);
assert.match(authUi,/throw new Error\("Signed-in user cannot access the selected cloud league\."\)/);

assert.match(authUi,/async function maybeActivateCloudMode\(messagePrefix="Cloud mode activated\."\)/);
assert.doesNotMatch(authUi,/settings\.preferredDataProvider!=="supabase"\|\|settings\.cloudModeEnabled!==true/);
assert.doesNotMatch(authUi,/importState\.verification\?\.passed&&\$\("cloudActivationReviewed"\)\?\.checked/);

assert.match(authUi,/async function activateCloudRuntime\(leagueId,settingsPatch,messagePrefix\)/);
assert.match(authUi,/const league=await verifyCloudRuntimeAccess\(leagueId\)/);
assert.match(authUi,/const cloudDb=await loadCloudRuntimeData\(leagueId,settingsPatch\)/);
assert.match(authUi,/window\.setRuntimeDB\(cloudDb,\{renderAfter:true,saveLocal:false\}\)/);
assert.match(authUi,/setDataMode\(\{mode:"cloud",leagueId,leagueName:league\?\.name\|\|migrationState\.selectedLeague\?\.name\|\|null,cloudAvailable:true/);
assert.doesNotMatch(authUi,/if\(\(cloudDb\.players\|\|\[\]\)\.length/);
assert.doesNotMatch(authUi,/if\(cloudDb\.players\.length/);

assert.match(authUi,/cloudStore\.getPlayers\(leagueId\)/);
assert.match(authUi,/cloudStore\.getTeams\(leagueId\)/);
assert.match(authUi,/cloudStore\.getManagers\(leagueId\)/);
assert.match(authUi,/cloudStore\.getTrades\(leagueId\)/);
assert.match(authUi,/cloudStore\.selectRows\("player_metrics",leagueId\)/);
assert.match(authUi,/cloudStore\.selectRows\("calculated_player_scores",leagueId\)/);
assert.match(authUi,/cloudStore\.selectRows\("trade_assets",leagueId\)/);
assert.match(authUi,/cloudStore\.selectRows\("manager_preferences",leagueId\)/);
assert.match(authUi,/cloudStore\.selectRows\("player_snapshots",leagueId\)/);
assert.match(authUi,/cloudStore\.selectRows\("import_jobs",leagueId\)/);

console.log("cloudEnableData tests passed");
