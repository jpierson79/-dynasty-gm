import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importService=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");
const cloudStore=await readFile(new URL("../js/services/cloudStore.js",import.meta.url),"utf8");
const authUi=await readFile(new URL("../js/services/authUi.js",import.meta.url),"utf8");

const fantraxStart=importService.indexOf("async function importFantrax");
const hkbStart=importService.indexOf("async function importHkb");
const previewFantraxStart=importService.indexOf("async function previewFantrax");
const backfillStart=importService.indexOf("export async function dryRunFantraxIdBackfill");
assert.ok(fantraxStart>=0,"importFantrax must exist");
assert.ok(hkbStart>fantraxStart,"importHkb must follow importFantrax for scoped inspection");
assert.ok(previewFantraxStart>=0,"previewFantrax must exist");
assert.ok(backfillStart>previewFantraxStart,"backfill should follow previewFantrax for scoped inspection");

const fantraxBody=importService.slice(fantraxStart,hkbStart);
const previewFantraxBody=importService.slice(previewFantraxStart,backfillStart);

assert.match(importService,/import \{ PlayerIdentityResolver \} from "\.\/PlayerIdentityResolver\.js";/);
assert.match(importService,/import \{ InMemoryPlayerIdentityRepository \} from "\.\/identity\/InMemoryPlayerIdentityRepository\.js";/);
assert.match(fantraxBody,/new PlayerIdentityResolver\(\{repository:new InMemoryPlayerIdentityRepository\(maps\.players\)\}\)/);
assert.match(fantraxBody,/classifyFantraxRows\(playerRows,resolver\)/);
assert.match(importService,/function buildFantraxPlayerRows\(rows,ix,leagueId,maps,startRowNumber=2\)/);
assert.match(fantraxBody,/buildFantraxPlayerRows\(batch,ix,leagueId,maps,processed\+2\)/);
assert.match(fantraxBody,/cloudStore\.syncResolvedPlayers/);
assert.match(importService,/function collapseResolvedUpdates\(updates\)/);
assert.match(fantraxBody,/duplicateResolvedUpdatesCollapsed/);
assert.match(importService,/multiple_source_players_resolved_to_same_internal_id/);
assert.match(importService,/sourceRowSummary/);
assert.match(importService,/export function buildFantraxPreviewSummary/);
assert.match(importService,/const PLAYER_IDENTITY_BUILD="resolver-build-2026-07-15-fallback-fix"/);
assert.match(importService,/console\.info\("\[PlayerIdentityResolver\]",PLAYER_IDENTITY_BUILD\)/);
assert.match(previewFantraxBody,/buildFantraxPreviewSummary\(\{leagueId,file,rows,head,maps\}\)/);
assert.ok(!previewFantraxBody.includes("playerMatch("),"Fantrax preview must not use legacy playerMatch");
assert.match(importService,/existingCloudMatches/);
assert.match(importService,/newPlayersToInsert/);
assert.match(importService,/cloudPlayersLoaded/);
assert.match(importService,/previewPlayerCollectionSource:"cloud players"/);
assert.match(authUi,/previewSchema==="fantrax-identity-v2"/);
assert.match(authUi,/Existing cloud matches/);
assert.match(authUi,/New players to insert/);
assert.match(authUi,/Identity conflicts/);
assert.match(authUi,/Cloud players loaded/);
assert.match(authUi,/Resolver Diagnostics/);
assert.match(authUi,/Identity build/);
assert.match(authUi,/playerIdentityBuild/);
assert.ok(!fantraxBody.includes("cloudStore.syncPlayers"),"Fantrax import must not use legacy syncPlayers");
assert.match(cloudStore,/export async function syncResolvedPlayers/);
assert.match(cloudStore,/Resolved update batch contains duplicate player IDs/);
assert.match(cloudStore,/const duplicateUpdateIds=duplicateIds\(updates\)/);
assert.match(cloudStore,/from\("players"\)\.upsert\(stripPlayerUpdateRows\(updates\),\{onConflict:"id"\}\)\.select\("\*"\)/);
assert.match(cloudStore,/from\("players"\)\.insert\(stripPlayerInsertRows\(inserts\)\)\.select\("\*"\)/);

console.log("fantraxImportPipeline tests passed");
