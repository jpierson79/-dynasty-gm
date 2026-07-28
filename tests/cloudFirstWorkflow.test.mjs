import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authUi=await readFile(new URL("../js/services/authUi.js",import.meta.url),"utf8");
const cloudStore=await readFile(new URL("../js/services/cloudStore.js",import.meta.url),"utf8");
const cloudMigration=await readFile(new URL("../js/services/cloudMigrationService.js",import.meta.url),"utf8");
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");

assert.match(html,/<h2>Cloud League<\/h2>/);
assert.match(html,/<h2>Cloud Imports<\/h2>/);
assert.match(html,/<h2>Cloud Data Health<\/h2>/);
assert.match(html,/id="cloudLeagueSelect"/);
assert.match(html,/id="cloudRefreshLeaguesButton"/);
assert.doesNotMatch(html,/Preview Local Migration|Run Local Migration|cloudBackupReviewed|cloudRunMigrationButton|cloudPreviewMigrationButton|cloudLocalModeButton|cloudActivationReviewed|cloudEnableButton|Enable Cloud Data/);

assert.match(authUi,/function handleSelectCloudLeague\(\)/);
assert.match(authUi,/\$\("cloudLeagueSelect"\)\?\.addEventListener\("change",handleSelectCloudLeague\)/);
assert.match(authUi,/cloudMigration\.setSelectedLeagueId\(league\.id\)/);
assert.match(authUi,/await maybeActivateCloudMode\("Cloud mode activated\."\)/);
assert.doesNotMatch(authUi,/cloudPreviewMigrationButton|cloudRunMigrationButton|cloudBackupReviewed|handleRunMigration|handlePreviewMigration|renderMigrationProgress/);
assert.doesNotMatch(authUi,/Local players|Local managers|Local teams|Last migration date|Migration status/);

assert.match(cloudStore,/supabase\.from\("league_members"\)\.select\("league_id"\)\.eq\("user_id",user\.id\)/);
assert.match(cloudStore,/supabase\.from\("leagues"\)\.select\("\*"\)\.in\("id",sharedIds\)/);
assert.match(cloudMigration,/const ACTIVE_LEAGUE_KEY="dynasty_active_league_id"/);
assert.match(cloudMigration,/localStore\(\)\?\.saveSettings\?\.\(merged\)/);
assert.doesNotMatch(cloudMigration,/window\.saveDB\?\.\(false\)/);

console.log("cloudFirstWorkflow tests passed");
