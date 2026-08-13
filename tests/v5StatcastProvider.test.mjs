import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fetchHitterSeasonMetrics, fetchPitcherSeasonMetrics } from "../v5/js/providers/baseballSavantStatcastProvider.js";
import { applyAutomatedStatcastRefresh, previewAutomatedStatcastRefresh, resolveStatcastRows, statcastRefreshHealth } from "../v5/js/services/statcastProviderService.js";
import { renderImports } from "../v5/js/views/importsView.js";

const expectedHeader='"last_name, first_name","player_id","year","pa","bip","ba","est_ba","slg","est_slg","woba","est_woba"';
const expectedPitcherHeader=`${expectedHeader},"era","xera"`;
const contactHeader='"last_name, first_name","player_id","attempts","avg_hit_angle","anglesweetspotpercent","max_hit_speed","avg_hit_speed","ev95plus","ev95percent","barrels","brl_percent","brl_pa"';
const sprintHeader='"last_name, first_name","player_id","sprint_speed"';
const csv={
  expected_statistics:`${expectedHeader}\n"Doe, Jane","101","2026","100","70",".280",".300",".500",".540",".350",".370"\n"Missing, Player","999","2026","10","5",".200",".210",".300",".310",".250",".260"`,
  expected_pitcher:`${expectedPitcherHeader}\n"Roe, John","202","2026","120","80",".220",".210",".350",".330",".290",".280","3.40","3.10"`,
  statcast_hitter:`${contactHeader}\n"Doe, Jane","101","70","12.4","36.2","112.1","91.4","30","42.9","9","12.9","9.0"`,
  statcast_pitcher:`${contactHeader}\n"Roe, John","202","80","10.1","31.0","111.0","87.5","25","31.3","5","6.3","4.2"`,
  sprint_speed:`${sprintHeader}\n"Doe, Jane","101","29.1"`
};
function response(body,type="text/csv; charset=utf-8"){return {ok:true,status:200,headers:{get:name=>name.toLowerCase()==="content-type"?type:""},text:async()=>body}}
function hitterFetch(url){if(url.includes("expected_statistics"))return response(csv.expected_statistics);if(url.includes("sprint_speed"))return response(csv.sprint_speed);return response(csv.statcast_hitter)}
function pitcherFetch(url){if(url.includes("expected_statistics"))return response(csv.expected_pitcher);return response(csv.statcast_pitcher)}

const hitter=await fetchHitterSeasonMetrics({season:2026,fetchImpl:hitterFetch});
assert.equal(hitter.rows[0].mlbamId,"101");
assert.equal(hitter.rows[0].metrics.pa,100);
assert.equal(hitter.rows[0].metrics.xba,.3);
assert.equal(hitter.rows[0].metrics.xslg,.54);
assert.equal(hitter.rows[0].metrics.xwoba,.37);
assert.equal(hitter.rows[0].metrics.barrelRate,12.9);
assert.equal(hitter.rows[0].metrics.hardHitRate,42.9);
assert.equal(hitter.rows[0].metrics.averageExitVelocity,91.4);
assert.equal(hitter.rows[0].metrics.maxExitVelocity,112.1);
assert.equal(hitter.rows[0].metrics.sprintSpeed,29.1);
assert.equal(hitter.sources.length,3);
assert.ok(hitter.sources.every(source=>source.checksum&&source.schemaVersion&&source.fetchedAt));
const reorderedExpected=`${expectedHeader}\n"Missing, Player","999","2026","10","5",".200",".210",".300",".310",".250",".260"\n"Doe, Jane","101","2026","100","70",".280",".300",".500",".540",".350",".370"`;
const reordered=await fetchHitterSeasonMetrics({season:2026,fetchImpl:url=>url.includes("expected_statistics")?response(reorderedExpected):hitterFetch(url)});
assert.equal(reordered.sources.find(source=>source.sourceType==="expected_statistics").checksum,hitter.sources.find(source=>source.sourceType==="expected_statistics").checksum,"equivalent row ordering has a stable source checksum");

const pitcher=await fetchPitcherSeasonMetrics({season:2026,fetchImpl:pitcherFetch});
assert.equal(pitcher.rows[0].metrics.xera,3.1);
assert.equal(pitcher.rows[0].metrics.xwobaAllowed,.28);
assert.equal(pitcher.rows[0].metrics.hardHitRateAllowed,31.3);
assert.equal(pitcher.sources.length,2);

await assert.rejects(fetchHitterSeasonMetrics({season:2026,fetchImpl:()=>response("player_id,bad\n101,value")}),/schema drift/);
await assert.rejects(fetchHitterSeasonMetrics({season:2026,fetchImpl:()=>response("<html>bad</html>","text/html")}),/unsupported content type/);
await assert.rejects(fetchHitterSeasonMetrics({season:2010,fetchImpl:hitterFetch}),/unsupported/);

const exactPlayers=[{id:"uuid-101",mlbam_id:101,name:"Stored Different Name",owner_team_id:"team-1",roster_status:"ACTIVE",fantrax_id:"*F101*"}];
const resolution=resolveStatcastRows(hitter,exactPlayers);
assert.equal(resolution.matched.length,1);
assert.equal(resolution.matched[0].player.id,"uuid-101");
assert.equal(resolution.unmatched.length,1);
assert.equal(resolveStatcastRows(hitter,[...exactPlayers,{id:"duplicate",mlbam_id:"101"}]).conflicts.length,1);

const repositories={players:async()=>exactPlayers,metrics:async()=>[]};
const provider=async()=>hitter;
const preview=await previewAutomatedStatcastRefresh({leagueId:"league-1",playerType:"hitter",season:2026,provider,repositories});
assert.equal(preview.status,"READY");
assert.equal(preview.plan.inserted.length,1);
assert.equal(preview.resolution.unmatched.length,1);
assert.equal(preview.plan.writeRows[0].player_id,"uuid-101");
assert.equal(preview.plan.writeRows[0].metrics._statcast.mlbamId,"101");
assert.equal("owner_team_id" in preview.plan.writeRows[0],false);
assert.equal("roster_status" in preview.plan.writeRows[0],false);
assert.equal("fantrax_id" in preview.plan.writeRows[0],false);

let coordinatorWrites=0,jobFinishes=[],jobStarts=[];
const refreshSession={id:"session-1",intendedTypes:["hitter","pitcher"],sequence:1,startedAt:"2026-08-11T10:00:00.000Z"};
const applied=await applyAutomatedStatcastRefresh({leagueId:"league-1",playerType:"hitter",reviewedPreview:preview,refreshSession,repositories:{
  startJob:async(_league,row)=>(jobStarts.push(row),{id:"job-1"}),upsert:async(_league,rows)=>{coordinatorWrites+=rows.length;return rows},finishJob:async(_league,_id,row)=>{jobFinishes.push(row);return row}
}});
assert.equal(applied.inserted,1);assert.equal(applied.updated,0);assert.equal(applied.status,"partial");assert.equal(applied.importJobId,"job-1");assert.equal(applied.importType,"statcast_automated_hitter");assert.equal(coordinatorWrites,1);assert.deepEqual(jobStarts[0].sourceMetadata.refreshSession,refreshSession);assert.equal(jobFinishes[0].status,"partial");assert.equal(jobFinishes[0].sourceMetadata.outcome.unchanged,0);assert.deepEqual(jobFinishes[0].sourceMetadata.refreshSession,refreshSession);

const partialBatchError=Object.assign(new Error("batch two failed"),{statcastBatchResult:{savedCount:1,failedBatchSize:1,remainingCount:1,batchStart:1}}),partialFinishes=[];
await assert.rejects(applyAutomatedStatcastRefresh({leagueId:"league-1",playerType:"hitter",reviewedPreview:preview,repositories:{startJob:async()=>({id:"job-2"}),upsert:async()=>{throw partialBatchError},finishJob:async(_league,_id,row)=>{partialFinishes.push(row);return row}}}),/batch two failed/);
assert.equal(partialFinishes[0].status,"partial");assert.equal(partialFinishes[0].inserted,1);assert.equal(partialFinishes[0].failed,1);

const existing={...preview.plan.writeRows[0],id:"metric-1"};
const repeat=await previewAutomatedStatcastRefresh({leagueId:"league-1",playerType:"hitter",season:2026,provider,repositories:{players:async()=>exactPlayers,metrics:async()=>[existing]}});
assert.equal(repeat.plan.unchanged.length,1);assert.equal(repeat.plan.writeRows.length,0,"identical snapshot is idempotent");

const prior={...existing,metrics:{...existing.metrics,sprintSpeed:28.5,retainedWhenBlank:77,_statcast:{...existing.metrics._statcast,snapshotId:"old"}}};
const blankSprint={...hitter,rows:hitter.rows.map(row=>row.mlbamId==="101"?{...row,metrics:{...row.metrics,sprintSpeed:undefined}}:row)};
delete blankSprint.rows[0].metrics.sprintSpeed;
const merged=await previewAutomatedStatcastRefresh({leagueId:"league-1",playerType:"hitter",season:2026,provider:async()=>blankSprint,repositories:{players:async()=>exactPlayers,metrics:async()=>[prior]}});
assert.equal(merged.plan.updated[0].metrics.sprintSpeed,28.5);
assert.equal(merged.plan.updated[0].metrics.retainedWhenBlank,77);

const duplicatePreview=await previewAutomatedStatcastRefresh({leagueId:"league-1",playerType:"hitter",season:2026,provider,repositories:{players:async()=>[...exactPlayers,{id:"duplicate",mlbam_id:101}],metrics:async()=>[]}});
assert.equal(duplicatePreview.status,"BLOCKED");
await assert.rejects(applyAutomatedStatcastRefresh({leagueId:"league-1",playerType:"hitter",reviewedPreview:duplicatePreview,repositories:{}}),/Blocked/);

const healthUnavailable=statcastRefreshHealth({available:false,error:"query failed"});
assert.equal(healthUnavailable.status,"UNAVAILABLE");assert.equal(healthUnavailable.rowsFetched,undefined);
const now=Date.parse("2026-08-11T12:00:00.000Z"),job={import_type:"statcast_automated_hitter",status:"completed",completed_at:"2026-08-11T11:00:00.000Z",rows_processed:2,rows_matched:1,rows_unmatched:1,rows_inserted:1,rows_updated:0,rows_failed:0,source_metadata:{provider:"Baseball Savant",season:2026,snapshotId:"hitter-snapshot",outcome:{unchanged:3,warningCount:0},sources:[{sourceType:"hitter-feed",checksum:"hitter-source",schemaVersion:"hitter-schema",rowCount:2,fetchedAt:"2026-08-11T10:00:00.000Z"}]}};
const healthy=statcastRefreshHealth({available:true,importJobs:[job],metricRows:[existing],now});
assert.equal(healthy.status,"SUCCESS");assert.equal(healthy.stale,false);assert.equal(healthy.types.hitter.matched,1);assert.equal(healthy.types.hitter.unmatched,1);assert.equal(healthy.types.hitter.unchanged,3);assert.equal(healthy.types.hitter.sources[0].sourceChecksum,"hitter-source");assert.equal(healthy.types.hitter.sources[0].schemaChecksum,"hitter-schema");assert.equal(healthy.types.pitcher.status,"NEVER_RUN");assert.equal(healthy.session.status,"NOT_RUN");
assert.equal(statcastRefreshHealth({available:true,importJobs:[job],metricRows:[existing],now:now+48*60*60*1000}).stale,true);
const coordinated=id=>({refreshSession:{id,intendedTypes:["hitter","pitcher"],startedAt:"2026-08-11T10:00:00.000Z"}}),pitcherJob={...job,import_type:"statcast_automated_pitcher",status:"partial",rows_processed:4,rows_matched:3,rows_unmatched:1,rows_inserted:2,rows_updated:1,rows_failed:1,source_metadata:{...job.source_metadata,snapshotId:"pitcher-snapshot",sources:[{sourceType:"pitcher-feed",checksum:"pitcher-source",schemaVersion:"pitcher-schema"}],...coordinated("session-1")}},hitterJob={...job,source_metadata:{...job.source_metadata,...coordinated("session-1")}};
const coordinatedHealth=statcastRefreshHealth({available:true,importJobs:[pitcherJob,hitterJob],metricRows:[existing],now});assert.equal(coordinatedHealth.status,"PARTIAL");assert.equal(coordinatedHealth.types.hitter.status,"SUCCESS");assert.equal(coordinatedHealth.types.pitcher.status,"PARTIAL");assert.equal(coordinatedHealth.session.status,"PARTIAL");assert.deepEqual(coordinatedHealth.session.typesCompleted,["hitter"]);assert.deepEqual(coordinatedHealth.session.typesPartial,["pitcher"]);assert.equal(coordinatedHealth.types.pitcher.failed,1);assert.equal(coordinatedHealth.types.pitcher.sources[0].sourceChecksum,"pitcher-source");assert.equal(coordinatedHealth.types.pitcher.sources[0].schemaChecksum,"pitcher-schema");

const ui=renderImports({}, {statcast:{season:2026,sessionStatus:"NOT_RUN",protectedBaseline:{},types:{hitter:{preview,reviewed:false,running:false,result:null,error:""},pitcher:{preview:null,reviewed:false,running:false,result:null,error:""}}}});
assert.match(ui,/Automated Statcast Refresh/);assert.match(ui,/Preview HITTERS/);assert.match(ui,/Apply HITTERS/);assert.match(ui,/exact hitter MLBAM/);assert.match(ui,/PITCHERS/);

const root=new URL("../",import.meta.url);
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const view=await readFile(new URL("v5/js/views/importsView.js",root),"utf8");
const service=await readFile(new URL("v5/js/services/statcastProviderService.js",root),"utf8");
const migration=await readFile(new URL("supabase/migrations/012_statcast_refresh_metadata.sql",root),"utf8");
assert.match(main,/previewAutomatedStatcastRefresh/);assert.match(main,/applyAutomatedStatcastRefresh/);
assert.doesNotMatch(view,/baseballsavant\.mlb\.com|fetch\(/,"views do not contain provider or metric logic");
assert.doesNotMatch(service,/calculated_player_scores|owner_team_id|roster_status|fantrax_id/);
assert.match(migration,/add column if not exists source_metadata jsonb/);assert.doesNotMatch(migration,/drop table|truncate|delete from/i);

console.log("v5StatcastProvider tests passed");
