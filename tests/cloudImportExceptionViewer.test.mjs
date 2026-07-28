import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authUi=await readFile(new URL("../js/services/authUi.js",import.meta.url),"utf8");
const importService=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");

assert.match(authUi,/const importExceptionState=\{\s*step:null,\s*summary:null,\s*details:\[\]\s*\}/);
assert.match(authUi,/function renderImportProgress\(payload\)/);
["Matched","Inserted","Updated","Skipped","Warnings","Errors"].forEach(label=>{
  assert.match(authUi,new RegExp(`<span>${label}<\\/span>`));
});
assert.match(authUi,/data-import-exceptions="view">View Details<\/button>/);
assert.match(authUi,/data-import-exceptions="export">Export Warnings CSV<\/button>/);
assert.match(authUi,/function renderImportExceptionDetails\(\)/);
assert.match(authUi,/function exportImportWarnings\(\)/);
["CSV row","Player name","Fantrax ID","MLBAM ID","Team","Import action attempted","Failure reason","Suggested resolution"].forEach(label=>{
  assert.match(authUi,new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});
assert.match(authUi,/downloadCsv\(`cloud-import-warnings-\$\{importExceptionState\.step\|\|"import"\}\.csv`/);
assert.match(authUi,/Skipped because preview mismatch/);
assert.match(authUi,/\[data-import-exceptions\]/);

assert.match(importService,/const EXCEPTION_DETAIL_LIMIT=5000/);
assert.match(importService,/function exceptionDetail\(/);
assert.match(importService,/function reasonSuggestion\(/);
assert.match(importService,/function duplicateIdentityExceptionDetails\(rows,key,label\)/);
["Duplicate Fantrax ID","Duplicate MLBAM ID","No matching player","Ambiguous normalized name","Unknown team","Unknown manager","Malformed CSV","Missing required column","Skipped because preview mismatch"].forEach(reason=>{
  assert.match(importService,new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

assert.match(importService,/async function importFantrax/);
assert.match(importService,/exceptionDetails/);
assert.match(importService,/warnings:exceptionDetails\.length/);
assert.match(importService,/async function importHkb/);
assert.match(importService,/action:"Update player HKB values"/);
assert.match(importService,/async function importStatcast/);
assert.match(importService,/action:`Upsert Statcast \$\{type\} metrics`/);
assert.match(importService,/async function importTrades/);
assert.match(importService,/action:"Insert trade asset"/);
assert.match(importService,/async function importCustomJson/);
assert.match(importService,/reason:"Unknown manager"/);
assert.match(importService,/action:"Update player notes"/);

console.log("cloudImportExceptionViewer tests passed");
