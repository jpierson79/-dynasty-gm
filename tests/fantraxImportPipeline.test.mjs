import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const importService=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");
const cloudStore=await readFile(new URL("../js/services/cloudStore.js",import.meta.url),"utf8");

const fantraxStart=importService.indexOf("async function importFantrax");
const hkbStart=importService.indexOf("async function importHkb");
assert.ok(fantraxStart>=0,"importFantrax must exist");
assert.ok(hkbStart>fantraxStart,"importHkb must follow importFantrax for scoped inspection");

const fantraxBody=importService.slice(fantraxStart,hkbStart);

assert.match(importService,/import \{ PlayerIdentityResolver \} from "\.\/PlayerIdentityResolver\.js";/);
assert.match(importService,/import \{ InMemoryPlayerIdentityRepository \} from "\.\/identity\/InMemoryPlayerIdentityRepository\.js";/);
assert.match(fantraxBody,/new PlayerIdentityResolver\(\{repository:new InMemoryPlayerIdentityRepository\(maps\.players\)\}\)/);
assert.match(fantraxBody,/classifyFantraxRows\(playerRows,resolver\)/);
assert.match(fantraxBody,/cloudStore\.syncResolvedPlayers/);
assert.match(importService,/function collapseResolvedUpdates\(updates\)/);
assert.match(fantraxBody,/duplicateResolvedUpdatesCollapsed/);
assert.match(importService,/multiple_source_players_resolved_to_same_internal_id/);
assert.match(importService,/sourceRowSummary/);
assert.ok(!fantraxBody.includes("cloudStore.syncPlayers"),"Fantrax import must not use legacy syncPlayers");
assert.match(cloudStore,/export async function syncResolvedPlayers/);
assert.match(cloudStore,/Resolved update batch contains duplicate player IDs/);
assert.match(cloudStore,/const duplicateUpdateIds=duplicateIds\(updates\)/);
assert.match(cloudStore,/from\("players"\)\.upsert\(stripPlayerUpdateRows\(updates\),\{onConflict:"id"\}\)\.select\("\*"\)/);
assert.match(cloudStore,/from\("players"\)\.insert\(stripPlayerInsertRows\(inserts\)\)\.select\("\*"\)/);

console.log("fantraxImportPipeline tests passed");
