import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeFantraxRosterStatus } from "../js/services/cloudCsvImportService.js";

const importService=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");
const cloudStore=await readFile(new URL("../js/services/cloudStore.js",import.meta.url),"utf8");

assert.match(importService,/const NON_TEAM_STATUS_TOKENS=new Set\(/);
["fa","free agent","waivers","w","active","reserve","il","minors"].forEach(token=>{
  assert.ok(importService.includes(`"${token}"`),`${token} must be excluded from fantasy-team creation`);
});
assert.match(importService,/function stripHtml\(value\)/);
assert.match(importService,/replace\(\s*\/<\[\^>\]\*>\/g/);
assert.match(importService,/function detectedFantasyTeamTokens\(rows,ix\)/);
assert.match(importService,/filter\(token=>token&&!isNonTeamStatusToken\(token\)\)/);
assert.match(importService,/owner_team_id:matchedTeam\?matchedTeam\.id:null/);
assert.match(importService,/roster_status:rosterStatus/);
assert.match(importService,/availability_status:availabilityStatus/);
assert.match(importService,/is_free_agent:freeAgent/);
assert.match(importService,/ownershipColumnDetected:headerName\(head,ix\.owner\)/);
assert.match(importService,/rosterSlotColumnDetected:headerName\(head,ix\.rosterSlot\)/);
assert.match(importService,/distinctRawRosterTokens:rosterSlotDiagnostics\.rawTokens/);
assert.match(importService,/normalizedRosterStatusCounts:rosterSlotDiagnostics\.mappingCounts/);
assert.match(importService,/unknownRosterTokens:rosterSlotDiagnostics\.unknownTokens/);
assert.match(importService,/first25UnclassifiedExamples:rosterSlotDiagnostics\.unclassifiedExamples/);
assert.match(importService,/fantasyTeamsDetected/);
assert.match(importService,/nonTeamStatusTokensDetected/);
assert.match(importService,/first50AmbiguousOrMalformed/);
assert.match(cloudStore,/delete out\.availability_status/);

assert.equal(normalizeFantraxRosterStatus("Active",{owned:true}),"ACTIVE");
assert.equal(normalizeFantraxRosterStatus("Bench",{owned:true}),"RESERVE");
assert.equal(normalizeFantraxRosterStatus("BN",{owned:true}),"RESERVE");
["IL","IL10","IL15","IL60","IR","Injured Reserve"].forEach(value=>assert.equal(normalizeFantraxRosterStatus(value,{owned:true}),"IL"));
["Minors","Minor League","MiLB","Farm","NA"].forEach(value=>assert.equal(normalizeFantraxRosterStatus(value,{owned:true,source:"rosterSlot"}),"MINORS"));
assert.equal(normalizeFantraxRosterStatus("Mystery Slot",{owned:true}),"UNCLASSIFIED");
assert.equal(normalizeFantraxRosterStatus("",{owned:true}),"UNCLASSIFIED");
assert.equal(normalizeFantraxRosterStatus("FA",{owned:true}),"UNCLASSIFIED","owned players must never be marked FREE_AGENT from slot text");
assert.equal(normalizeFantraxRosterStatus("Waivers",{freeAgent:true,source:"ownership"}),"FREE_AGENT");

console.log("fantraxOwnershipMapping tests passed");
