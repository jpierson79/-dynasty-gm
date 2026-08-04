import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runWithDataHealthTimeout } from "../v5/js/services/dataHealthExecutionService.js";
import { tradeSelectionHealthStatus } from "../v5/js/services/dataHealthService.js";
import { renderSettingsDataHealth } from "../v5/js/views/settingsDataHealthView.js";

assert.equal(await runWithDataHealthTimeout(async()=>"complete",50),"complete");
await assert.rejects(runWithDataHealthTimeout(()=>new Promise(()=>{}),5),/timed out after 1 seconds/);
await assert.rejects(runWithDataHealthTimeout(()=>Promise.reject(new Error("cloud read failed")),50),/cloud read failed/);

const running=renderSettingsDataHealth({health:null,healthRunning:true,healthError:"",engineRun:{}});
assert.match(running,/id="runDataHealth"[^>]*disabled/);
assert.match(running,/Running Data Health/);
assert.match(running,/role='status'/);

const failed=renderSettingsDataHealth({health:null,healthRunning:false,healthError:"Timed out safely",engineRun:{}});
assert.match(failed,/role="alert">Timed out safely/);

const root=new URL("../",import.meta.url);
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");
assert.match(main,/if\(appState\.healthRunning\)return/);
assert.match(main,/runWithDataHealthTimeout\(\(\)=>runDataHealth/);
assert.match(main,/healthRunning:false,healthError:String/);
assert.match(dataHealth,/buildScoreDiagnosticsFromRows\(leagueId,playerRows,metricRows,scoreRows/);
assert.doesNotMatch(dataHealth,/await buildLiveScoreDiagnostics/);
assert.match(dataHealth,/excludedInvalidTeamRowsFromRows\(rawTeamRows,playerRows\)/);
assert.match(dataHealth,/const \[waiverPage,rosterPage\]=await Promise\.all/);

assert.equal(tradeSelectionHealthStatus({userTeamExists:true}),"WARNING","an idle Trade Center is not a data failure");
assert.equal(tradeSelectionHealthStatus({userTeamExists:true,partnerTeamId:"partner",partnerExists:true}),"PASS");
assert.equal(tradeSelectionHealthStatus({userTeamExists:true,partnerTeamId:"missing",partnerExists:false}),"FAIL");
assert.equal(tradeSelectionHealthStatus({userTeamExists:false}),"FAIL");

console.log("v5DataHealthExecution tests passed");
