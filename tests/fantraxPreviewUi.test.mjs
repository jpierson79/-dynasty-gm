import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
const authUi=await readFile(new URL("../js/services/authUi.js",import.meta.url),"utf8");
const importService=await readFile(new URL("../js/services/cloudCsvImportService.js",import.meta.url),"utf8");

assert.doesNotMatch(html,/Preview Local Migration|Run Local Migration|cloudPreviewMigrationButton|cloudRunMigrationButton|cloudBackupReviewed|cloudMigrationPreview|cloudMigrationProgress|cloudLocalModeButton/);
assert.match(html,/id="cloudLeagueSelect"/);
assert.match(html,/id="cloudRefreshLeaguesButton"/);
assert.match(html,/<h2>Cloud League<\/h2>/);
assert.match(html,/<h2>Cloud Imports<\/h2>/);
assert.match(html,/<h2>Cloud Data Health<\/h2>/);

const fantraxCardStart=html.indexOf("<b>Fantrax players and rosters</b>");
const hkbCardStart=html.indexOf("<b>HarryKnowsBall values</b>");
assert.ok(fantraxCardStart>=0,"Fantrax cloud import card must exist");
assert.ok(hkbCardStart>fantraxCardStart,"HKB card should follow Fantrax card");
const fantraxCard=html.slice(fantraxCardStart,hkbCardStart);

assert.match(fantraxCard,/id="cloudFantraxFile"/);
assert.match(fantraxCard,/id="cloudPreviewFantraxButton"[^>]*>Preview<\/button>/);
assert.match(fantraxCard,/id="cloudConfirmFantrax"[^>]*>\s*I reviewed this preview and want to upload it\./);
assert.match(fantraxCard,/id="cloudConfirmFantraxTeams"[^>]*>\s*I confirmed the detected fantasy-team list and excluded status tokens\./);
assert.match(fantraxCard,/id="cloudImportFantraxButton"[^>]*disabled[^>]*>Upload Fantrax Players<\/button>/);
assert.ok(!fantraxCard.includes("Import Fantrax Players"),"Fantrax card must not expose the old one-click import label");
assert.match(html,/id="cloudImportPreview"/);

assert.match(authUi,/Object\.entries\(previewButtonIds\)\.forEach\(\(\[step,id\]\)=>\$\(id\)\?\.addEventListener\("click",\(\)=>previewCloudImportStep\(step\)\)\)/);
assert.match(authUi,/\$\("cloudImportFantraxButton"\)\?\.addEventListener\("click",\(\)=>runCloudImportStep\("fantrax"\)\)/);
assert.match(authUi,/const fileInputIds=\{fantrax:"cloudFantraxFile",hkb:"cloudHkbFile",statcastHitters:"cloudStatcastHittersFile",statcastPitchers:"cloudStatcastPitchersFile",trades:"cloudTradesFile",custom:"cloudCustomFile"\}/);
assert.match(authUi,/Object\.entries\(fileInputIds\)\.forEach\(\(\[step,id\]\)=>\$\(id\)\?\.addEventListener\("change",\(\)=>clearImportPreview\(step\)\)\)/);
assert.match(authUi,/function clearImportPreview\(step\)/);
assert.match(authUi,/delete importState\.previews\[step\]/);
assert.match(authUi,/delete importState\.previewFiles\[step\]/);
assert.match(authUi,/importState\.previewFiles\[step\]=file/);
assert.match(authUi,/!importState\.previews\[step\]/);
assert.match(authUi,/!\$\(confirmIds\[step\]\)\?\.checked/);
assert.match(authUi,/importState\.previewFiles\[step\]&&importState\.previewFiles\[step\]!==file/);
assert.match(authUi,/step!=="fantrax"\|\|\$\("cloudConfirmFantraxTeams"\)\?\.checked/);
assert.match(authUi,/Confirm the detected fantasy-team list before uploading Fantrax players/);
assert.match(authUi,/stageErrorMessage\("Parsing",e,"Preview failed\."\)/);

const previewFantraxStart=importService.indexOf("async function previewFantrax");
const backfillStart=importService.indexOf("export async function dryRunFantraxIdBackfill");
const previewFantraxBody=importService.slice(previewFantraxStart,backfillStart);
assert.ok(previewFantraxStart>=0,"previewFantrax must still exist");
assert.ok(backfillStart>previewFantraxStart,"previewFantrax scope must be found");
assert.match(previewFantraxBody,/buildFantraxPreviewSummary\(\{leagueId,file,rows,head,maps\}\)/);
assert.ok(!previewFantraxBody.includes("syncResolvedPlayers"),"Fantrax preview must not persist player writes");
assert.ok(!previewFantraxBody.includes("createJob("),"Fantrax preview must not create import jobs");
assert.ok(!previewFantraxBody.includes("insertRows("),"Fantrax preview must not insert rows");
assert.ok(!previewFantraxBody.includes("upsertRows("),"Fantrax preview must not upsert rows");
assert.ok(!previewFantraxBody.includes("updateRow("),"Fantrax preview must not update rows");

const sourceCards=[
  ["hkb","HarryKnowsBall values","Statcast hitters",/id="cloudHkbFile"/,/id="cloudPreviewHkbButton"[^>]*>Preview<\/button>/,/id="cloudConfirmHkb"[^>]*>\s*I reviewed this preview and want to upload it\./,/id="cloudImportHkbButton"[^>]*disabled[^>]*>Upload HKB Values<\/button>/],
  ["statcastHitters","Statcast hitters","Statcast pitchers",/id="cloudStatcastHittersFile"/,/id="cloudPreviewStatcastHittersButton"[^>]*>Preview<\/button>/,/id="cloudConfirmStatcastHitters"[^>]*>\s*I reviewed this preview and want to upload it\./,/id="cloudImportStatcastHittersButton"[^>]*disabled[^>]*>Upload Hitter Metrics<\/button>/],
  ["statcastPitchers","Statcast pitchers","Fantrax trade history",/id="cloudStatcastPitchersFile"/,/id="cloudPreviewStatcastPitchersButton"[^>]*>Preview<\/button>/,/id="cloudConfirmStatcastPitchers"[^>]*>\s*I reviewed this preview and want to upload it\./,/id="cloudImportStatcastPitchersButton"[^>]*disabled[^>]*>Upload Pitcher Metrics<\/button>/],
  ["trades","Fantrax trade history","Manager Intelligence",/id="cloudTradesFile"/,/id="cloudPreviewTradesButton"[^>]*>Preview<\/button>/,/id="cloudConfirmTrades"[^>]*>\s*I reviewed this preview and want to upload it\./,/id="cloudImportTradesButton"[^>]*disabled[^>]*>Upload Trade History<\/button>/],
  ["custom","Manager Intelligence","Cloud Data Health",/id="cloudCustomFile"[^>]*accept="\.json,application\/json"/,/id="cloudPreviewCustomButton"[^>]*>Preview<\/button>/,/id="cloudConfirmCustom"[^>]*>\s*I reviewed this preview and want to upload it\./,/id="cloudImportCustomButton"[^>]*disabled[^>]*>Upload Manager Intelligence<\/button>/]
];

sourceCards.forEach(([,startText,endText,filePattern,previewPattern,confirmPattern,uploadPattern])=>{
  const start=html.indexOf(startText);
  const end=html.indexOf(endText,start+startText.length);
  assert.ok(start>=0,`${startText} card must exist`);
  assert.ok(end>start,`${startText} card must be scoped before ${endText}`);
  const card=html.slice(start,end);
  assert.match(card,filePattern);
  assert.match(card,previewPattern);
  assert.match(card,confirmPattern);
  assert.match(card,uploadPattern);
});

assert.doesNotMatch(authUi,/if\(step==="hkb"\|\|step==="statcastHitters"\|\|step==="statcastPitchers"\|\|step==="trades"\|\|step==="custom"\)return importState\.stages\.fantrax==="Completed"/,"Other source imports must not be blocked behind Fantrax completion");
assert.match(html,/id="cloudImportStageSummary"/);

console.log("fantraxPreviewUi tests passed");
