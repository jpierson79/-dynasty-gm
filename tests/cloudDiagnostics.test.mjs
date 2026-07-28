import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authUi=await readFile(new URL("../js/services/authUi.js",import.meta.url),"utf8");
const cloudStore=await readFile(new URL("../js/services/cloudStore.js",import.meta.url),"utf8");
const importService=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");

assert.match(importService,/diagnosticKey:"freeAgentOwnership"/);
assert.match(importService,/diagnosticKey:"duplicateNormalizedNames"/);
assert.match(importService,/const freeAgentInvalid=players\.filter\(p=>p\.is_free_agent&&p\.owner_team_id\)/);
assert.match(importService,/duplicateNameAffected/);

assert.match(cloudStore,/export async function getFreeAgentOwnershipDiagnostics/);
assert.match(cloudStore,/export async function getDuplicateNormalizedNameDiagnostics/);
assert.match(cloudStore,/eq\("is_free_agent",true\)\.not\("owner_team_id","is",null\)/);
assert.match(cloudStore,/function conflictReason\(player,resolvedTeamName\)/);
assert.match(cloudStore,/Status says FREE AGENT but owner_team_id is populated/);
assert.match(cloudStore,/Rostered player incorrectly classified as free agent/);
assert.match(cloudStore,/function classifyDuplicateGroup\(players\)/);
assert.match(cloudStore,/Same normalized name, different Fantrax IDs/);
assert.match(cloudStore,/Neither record has authoritative ID/);

const freeAgentDiagnosticsBody=cloudStore.slice(
  cloudStore.indexOf("export async function getFreeAgentOwnershipDiagnostics"),
  cloudStore.indexOf("export async function getDuplicateNormalizedNameDiagnostics")
);
assert.doesNotMatch(freeAgentDiagnosticsBody,/insertRows|upsertRows|updateRow|delete|remove/);

assert.match(authUi,/data-diagnostic="\$\{clean\(check\.diagnosticKey\)\}"/);
assert.match(authUi,/function renderDiagnostics\(data\)/);
assert.match(authUi,/Export Diagnostics CSV/);
assert.match(authUi,/pageSize:100/);
assert.match(authUi,/getFreeAgentOwnershipDiagnostics/);
assert.match(authUi,/getDuplicateNormalizedNameDiagnostics/);
assert.match(authUi,/\$\("cloudImportProgress"\)\?\.addEventListener\("click",event=>/);

console.log("cloudDiagnostics tests passed");
