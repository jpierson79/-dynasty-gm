import assert from "node:assert/strict";
import fs from "node:fs";
import { createGate4AcceptanceHarness, GATE4_EXPECTED_LEAGUE_ID } from "../v5/js/services/fantraxGate4AcceptanceHarness.js";
import { executeReviewedFantraxSync, fantraxSyncProductionDependencies } from "../v5/js/services/fantraxSyncCoordinator.js";
import { renderFantraxGate4Acceptance } from "../v5/js/views/fantraxGate4AcceptanceView.js";

const release=enabled=>({id:GATE4_EXPECTED_LEAGUE_ID,name:"Reddit Phanatics",settings:{fantraxRosterSyncRelease:{enabled,leagueId:GATE4_EXPECTED_LEAGUE_ID,reviewed:true,releaseId:"V5.4.6E_OPT_IN_10"}}});
const season={valid:true,externalLeagueId:"xryuc2ewmhi0d2vm",seasonYear:2026,leagueHistoryId:"8mifq27zmhi0d2vm",leagueHistoryAvailable:true};
const comparison={status:"MATCH",writeAllowed:true,reasons:[],observed:season,reviewed:season};
const preview=fetchedAt=>({externalLeagueId:season.externalLeagueId,period:"",data:{fetchedAt,seasonContextComparison:comparison}});
const id=index=>`00000000-0000-4000-8000-${String(index).padStart(12,"0")}`;
const rosterItems=Array.from({length:11},(_,index)=>({
  matchedPlayerUuid:id(index+1),matchedPlayer:{name:`Player ${index+1}`},fantraxApiPlayerId:`api${index+1}`,
  fantraxTeamId:"team000000000001",fantraxTeamName:"Exact Team",matchedTeamUuid:"10000000-0000-4000-8000-000000000001",
  currentOwnerTeamId:"10000000-0000-4000-8000-000000000001",currentRosterStatus:"UNCLASSIFIED",normalizedRosterStatus:"ACTIVE",
  futureSyncRecommendation:"APPLY_FANTRAX_STATUS",playerIdentityResult:"MATCHED",teamIdentityResult:"MATCHED",ownershipDifference:false,activeManualOverride:false
}));
const tenIds=rosterItems.slice(0,10).map(row=>row.matchedPlayerUuid);

async function prepareHarness({persistenceAuthority=false,execute}={}){
  const canonicalState={authUser:{id:"user-1",email:"owner@example.com"},activeLeague:release(false)};
  const live={authUserId:"user-1",leagueId:GATE4_EXPECTED_LEAGUE_ID,releaseSignature:"V5.4.6E_OPT_IN_10:10:NEW_ALLOWED",period:"",externalLeagueId:season.externalLeagueId,previewFetchedAt:"preview-b",seasonContext:comparison,candidateIds:[...tenIds].sort()};
  const dependencies={appState:canonicalState,currentUser:async()=>canonicalState.authUser,liveContext:()=>structuredClone(live),...(execute?{executeReviewedFantraxSync:execute}:{})};
  const harness=createGate4AcceptanceHarness({artifactCommit:"exact-commit",persistenceAuthority,dependencies});
  harness.testLiveContext=live;
  harness.testAppState=canonicalState;
  await harness.recordAuthenticatedUser();
  harness.recordActiveLeague();
  harness.recordAuditBaseline([{id:"attempt-1",fantrax_sync_attempt_items:[{id:"item-1"}]}]);
  harness.recordGateA({teamIdentity:true,auditRecovery:true,manualOverrideProtection:true,databaseCap:true});
  harness.recordPreviewA(preview("preview-a"));
  harness.reviewCandidates(tenIds,rosterItems);
  await harness.recordProtectedBaseline({players:"players-hash",teams:"teams-hash",scores:"scores-hash",metrics:"metrics-hash",audit:"audit-hash"});
  harness.recordOptInTransition(release(false),release(true));
  harness.recordPreviewB(preview("preview-b"));
  canonicalState.activeLeague=release(true);
  canonicalState.fantraxPreview={...preview("preview-b"),data:{...preview("preview-b").data,rosterItems},rosterSyncSelectedIds:[...tenIds]};
  harness.recordGateB(release(true),rosterItems);
  await harness.buildManifest(release(true));
  harness.recordPreWriteGuards({authUserId:"user-1",leagueId:GATE4_EXPECTED_LEAGUE_ID,previewFetchedAt:"preview-b",manifestDigest:harness.state.manifestDigest,releaseSignature:harness.state.checkpoints.gateB.evidence.releaseSignature,seasonValid:true,periodValid:true,identityValid:true,candidateSetValid:true});
  const digest=await harness.humanConfirmationDigest();
  await harness.armHumanConfirmation({confirmationDigest:digest,manifestDigest:harness.state.manifestDigest});
  return harness;
}

const disabled=await prepareHarness();
assert.equal(disabled.state.persistenceAuthority,false,"an implementation-checkpoint harness has no persistence authority");
assert.equal(disabled.state.persistenceAvailable,false,"authority is required before persistence can become available");
assert.equal(disabled.state.persistenceExecutable,false);
assert.equal(disabled.state.checkpoints.previewAInvalidated.status,"PASS","opt-in transition explicitly invalidates Preview A");
assert.equal(disabled.state.previewA,null,"Preview A cannot survive the opt-in transition");
assert.ok(disabled.state.checkpoints.previewB.digest,"every checkpoint exposes a deterministic evidence digest");
assert.equal(disabled.state.manifest.version,"2");
assert.equal(disabled.state.manifest.rows.length,10);
const exactDigest=disabled.state.manifestDigest,confirmationDigest=await disabled.humanConfirmationDigest();
const wrongArm=await disabled.armHumanConfirmation({confirmationDigest,manifestDigest:"wrong-digest"});
assert.equal(wrongArm.status,"FAIL","the wrong exact manifest digest cannot arm persistence");
assert.equal(disabled.state.armed,false);
await disabled.armHumanConfirmation({confirmationDigest:await disabled.humanConfirmationDigest(),manifestDigest:exactDigest});
assert.equal(disabled.state.armed,false,"an exact digest cannot arm a session without persistence authority");
await assert.rejects(()=>disabled.persist(),/persistence is disabled/);
assert.equal(disabled.state.persistenceCalled,false,"disabled persistence cannot consume the one-call latch");

const elevenState={authUser:{id:"user-1"},activeLeague:release(false)};
const eleven=createGate4AcceptanceHarness({artifactCommit:"exact-commit",dependencies:{appState:elevenState,currentUser:async()=>elevenState.authUser}});
await eleven.recordAuthenticatedUser();eleven.recordActiveLeague();eleven.recordAuditBaseline([]);eleven.recordGateA({ready:true});eleven.recordPreviewA(preview("preview-a"));
assert.equal(eleven.reviewCandidates(rosterItems.map(row=>row.matchedPlayerUuid),rosterItems).status,"FAIL","the harness rejects an 11th candidate");
assert.match(eleven.state.checkpoints.candidates.reasons.join(" "),/Exactly 10/);

const substitution=await prepareHarness();
const changed=structuredClone(rosterItems);changed[0].normalizedRosterStatus="MINORS";
substitution.recordPreviewB(preview("preview-b-2"));
assert.equal(substitution.recordGateB(release(true),changed).status,"FAIL","Preview B cannot silently substitute or change a bound candidate");

let cancelledCalls=0;
const cancelled=await prepareHarness({persistenceAuthority:true,execute:async()=>{cancelledCalls+=1;throw new Error("cancelled persistence must not execute")}});
assert.equal(cancelled.state.armed,true);
assert.equal(cancelled.state.persistenceAvailable,true);
cancelled.cancelBeforePersistence();
assert.equal(cancelled.state.persistenceAuthority,false,"pre-persistence cancellation ends session authority");
assert.equal(cancelled.state.persistenceAvailable,false,"pre-persistence cancellation invalidates availability");
assert.equal(cancelled.state.persistenceExecutable,false,"pre-persistence cancellation invalidates executability");
assert.equal(cancelled.state.armed,false,"pre-persistence cancellation disarms an exact digest");
assert.equal(cancelled.state.persistenceCalled,false,"pre-persistence cancellation leaves the one-call latch unused");
assert.equal(cancelled.state.previewB,null);
assert.equal(cancelled.state.manifest,null);
assert.equal(cancelled.state.manifestDigest,"");
await assert.rejects(()=>cancelled.persist(),/persistence is disabled/);
assert.equal(cancelledCalls,0,"a cancelled session cannot reach the coordinator");

let calls=0,armed;
armed=await prepareHarness({persistenceAuthority:true,execute:async({beforeAttempt})=>{assert.equal(armed.state.persistenceAvailable,false,"the latch removes availability before coordinator invocation");assert.equal(armed.state.armed,false,"the harness disarms before coordinator invocation");await beforeAttempt();calls+=1;return {attempt:{id:"attempt-2"},digest:"durable",result:{reviewed:10,updated:[],skipped:[],failures:[]}}}});
assert.equal(armed.state.persistenceAuthority,true);
assert.equal(armed.state.persistenceAvailable,true,"all pre-write checkpoints make authority available without conflating it with arming");
assert.equal(armed.state.armed,true);
assert.equal(armed.state.persistenceExecutable,true,"availability plus exact-digest arming makes the one call executable");
await armed.persist();
assert.equal(calls,1,"the armed harness makes exactly one production-coordinator call");
assert.equal(armed.state.armed,false,"success leaves the harness disarmed");
assert.equal(armed.state.persistenceAvailable,false,"latch consumption removes persistence availability");
assert.equal(armed.state.persistenceExecutable,false);
await assert.rejects(()=>armed.persist(),/already been used/);
assert.equal(calls,1,"a second persistence call is impossible");

const drifted=await prepareHarness({persistenceAuthority:true,execute:async()=>{throw new Error("must not execute")}});
drifted.testLiveContext.period="139";
await assert.rejects(()=>drifted.persist(),/invalidated by authentication, league, preview, candidate, release, season, period, protected baseline, manifest, or digest drift/);
assert.equal(drifted.state.armed,false,"live context drift clears the arm state before persistence");
assert.equal(drifted.state.persistenceAvailable,false,"live context drift invalidates pre-write readiness");
assert.equal(drifted.state.persistenceCalled,false,"drift before invocation does not consume or enter the persistence boundary");

const previewDrifted=await prepareHarness({persistenceAuthority:true,execute:async()=>{throw new Error("must not execute")}});
previewDrifted.testAppState.fantraxPreview.data.fetchedAt="new-preview";
await assert.rejects(()=>previewDrifted.persist(),/invalidated/);
assert.equal(previewDrifted.state.armed,false,"a changed preview disarms before persistence");

const candidateDrifted=await prepareHarness({persistenceAuthority:true,execute:async()=>{throw new Error("must not execute")}});
candidateDrifted.testLiveContext.candidateIds=[...candidateDrifted.testLiveContext.candidateIds.slice(0,9),id(11)].sort();
await assert.rejects(()=>candidateDrifted.persist(),/invalidated/);
assert.equal(candidateDrifted.state.persistenceCalled,false,"candidate drift cannot reach the coordinator");

const failed=await prepareHarness({persistenceAuthority:true,execute:async()=>{throw new Error("guarded failure")}});
await assert.rejects(()=>failed.persist(),/guarded failure/);
assert.equal(failed.state.persistenceCalled,true,"a failed coordinator invocation consumes the one-call latch");
assert.equal(failed.state.armed,false,"a failed coordinator invocation cannot remain armed");
assert.equal(failed.state.persistenceAvailable,false,"a failed consumed invocation cannot remain available");
assert.throws(()=>failed.cancelBeforePersistence(),/consumed Gate 4 persistence session cannot be reset or reused/,"post-persistence cleanup cannot reset the latch");
assert.equal(failed.state.persistenceCalled,true);
await assert.rejects(()=>failed.persist(),/already been used/);

const manifestInput={leagueId:GATE4_EXPECTED_LEAGUE_ID,period:"",seasonContext:season,releaseTier:"V5.4.6E_OPT_IN_10",effectiveCap:10,updates:rosterItems.slice(0,10).map(row=>({id:row.matchedPlayerUuid,expectedOwnerTeamId:row.currentOwnerTeamId,currentRosterStatus:row.currentRosterStatus,roster_status:row.normalizedRosterStatus,fantraxApiPlayerId:row.fantraxApiPlayerId,fantraxTeamId:row.fantraxTeamId}))};
let repositoryCalls=0;
const guardedDependencies={...fantraxSyncProductionDependencies,findFantraxSyncAttempt:async()=>{repositoryCalls+=1;return null}};
await assert.rejects(()=>executeReviewedFantraxSync({manifestInput,beforeAttempt:()=>{throw new Error("stale preview")},dependencies:guardedDependencies}),/stale preview/);
assert.equal(repositoryCalls,0,"the immediate guard runs before any audit lookup or creation");

const main=fs.readFileSync(new URL("../v5/js/main.js",import.meta.url),"utf8");
assert.match(main,/executeReviewedFantraxSync/,"the normal UI calls the shared production coordinator");
assert.doesNotMatch(main,/applyFantraxRosterStatuses\(/,"the normal UI no longer carries a parallel raw apply orchestration");
const harnessSource=fs.readFileSync(new URL("../v5/js/services/fantraxGate4AcceptanceHarness.js",import.meta.url),"utf8");
assert.doesNotMatch(harnessSource,/\.from\(|service[_-]?role|localStorage|document\.cookie/i,"the harness has no raw Supabase, privileged, cookie, or token path");
assert.match(harnessSource,/executeReviewedFantraxSync/,"the harness delegates its sole write to the shared production coordinator");
assert.match(harnessSource,/fetchFantraxPublicPreview/,"Preview A and B use the canonical production preview service");
assert.match(harnessSource,/listFantraxSyncAttempts/,"the audit baseline uses the canonical authenticated audit repository");
const reviewView=fs.readFileSync(new URL("../v5/js/views/fantraxGate4AcceptanceView.js",import.meta.url),"utf8");
assert.doesNotMatch(reviewView,/applyFantraxRosterStatuses|service[_-]?role|document\.cookie/i,"the production view has no raw repository, privileged, cookie, or token path");
const disabledView=renderFantraxGate4Acceptance({gate4Acceptance:{...disabled.reviewArtifact(),artifact:disabled.reviewArtifact()}});
assert.match(disabledView,/Authority<\/span><b>NOT AUTHORIZED/i);
assert.match(disabledView,/Persistence<\/span><b>DISABLED/i);
assert.match(disabledView,/Arming<\/span><b>UNARMED/i);
assert.match(disabledView,/Latch<\/span><b>UNUSED/i,"a non-authorized harness renders each canonical state independently");
const readyArtifact={...armed.reviewArtifact(),persistenceCalled:false,persistenceAvailable:true,persistenceExecutable:false,armed:false};
const readyView=renderFantraxGate4Acceptance({gate4Acceptance:{...readyArtifact,stage:"UNARMED",artifact:readyArtifact,manifest:armed.state.manifest}});
assert.match(readyView,/Persistence<\/span><b>ENABLED/i);
assert.match(readyView,/Arming<\/span><b>UNARMED/i,"enabled-but-unarmed state is explicit");
const armedArtifact={...readyArtifact,persistenceExecutable:true,armed:true};
const armedView=renderFantraxGate4Acceptance({gate4Acceptance:{...armedArtifact,stage:"ARMED FOR EXACT DIGEST",artifact:armedArtifact,manifest:armed.state.manifest}});
assert.match(armedView,/Arming<\/span><b>ARMED/i);
assert.match(armedView,/persistGate4Once/i,"only the canonical executable state exposes persistence");
const usedArtifact={...armedArtifact,persistenceAvailable:false,persistenceExecutable:false,armed:false,persistenceCalled:true};
const usedView=renderFantraxGate4Acceptance({gate4Acceptance:{...usedArtifact,artifact:usedArtifact}});
assert.match(usedView,/Persistence<\/span><b>USED/i);
assert.match(usedView,/Latch<\/span><b>USED/i);
assert.doesNotMatch(usedView,/persistGate4Once/i,"a consumed latch cannot render persistence controls");

console.log("v5FantraxGate4AcceptanceHarness tests passed");
