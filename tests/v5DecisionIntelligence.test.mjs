import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTeamContext, DECISION_RULE_VERSION, findRosterUpgradeCandidates, recommendFreeAgent, recommendRosterPlayer, REASON_CODES } from "../v5/js/services/decisionIntelligenceService.js";
import { renderWaiverOpportunities } from "../v5/js/views/waiverOpportunitiesView.js";
import { renderMyRoster } from "../v5/js/views/rosterView.js";

const root=new URL("../",import.meta.url);
const service=await readFile(new URL("v5/js/services/decisionIntelligenceService.js",root),"utf8");
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const waiverView=await readFile(new URL("v5/js/views/waiverOpportunitiesView.js",root),"utf8");
const rosterViewSource=await readFile(new URL("v5/js/views/rosterView.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");

function player(overrides={}){
  const scores={ceiling_score:overrides.ceiling??65,floor_score:overrides.floor??55,confidence_score:overrides.confidence??70,acquisition_opportunity:overrides.acq??60};
  return {
    id:overrides.id||"p-1",
    name:overrides.name||"Player",
    positions:overrides.positions||["OF"],
    age:overrides.age??25,
    owner_team_id:overrides.owner_team_id??null,
    roster_status:overrides.roster_status??"FREE_AGENT",
    playerStage:overrides.stage||"MLB_EMERGING",
    hkb_value:overrides.hkb_value??1000,
    scoreVersion:"5.1.1",
    calculatedAt:"2026-07-27T00:00:00Z",
    scores,
    score:{dynasty_asset_score:overrides.dynasty??62,championship_impact:overrides.impact??58,risk_score:overrides.risk??45,trade_liquidity:overrides.liquidity??55,market_appreciation:overrides.market??60,breakout_score:overrides.breakout??60,explanation:{scores,metadata:{player_stage:overrides.stage||"MLB_EMERGING",confidence:{level:overrides.confidenceLevel||"MEDIUM",metricCount:overrides.metricCount??2,hasHkb:true,hasStableId:true,hasRoster:true}}}}
  };
}

const weakCatcher=player({id:"r-c",name:"Weak C",positions:["C"],owner_team_id:"team-1",roster_status:"ACTIVE",dynasty:43,impact:42,floor:38,confidence:70});
const surplusOf=player({id:"r-of",name:"Good OF",positions:["OF"],owner_team_id:"team-1",roster_status:"ACTIVE",dynasty:58,impact:54,floor:50,confidence:70});
const prospect=player({id:"r-pro",name:"Prospect",positions:["SS"],owner_team_id:"team-1",roster_status:"MINORS",stage:"PROSPECT_NEAR_MLB",dynasty:52,impact:40,ceiling:70,floor:35,confidence:68});
const unclassified=player({id:"r-u",name:"Unknown Slot",positions:["RP"],owner_team_id:"team-1",roster_status:"UNCLASSIFIED",dynasty:52,impact:50,confidence:70});
const roster=[weakCatcher,surplusOf,{...surplusOf,id:"r-of2"}, {...surplusOf,id:"r-of3"}, {...surplusOf,id:"r-of4"}, {...surplusOf,id:"r-of5"}, prospect, unclassified];
const freeCatcher=player({id:"fa-c",name:"Free C",positions:["C"],dynasty:64,impact:60,ceiling:72,acq:66,confidence:82});
const lowInfo=player({id:"fa-low",name:"Low Info",positions:["RP"],dynasty:54,impact:45,ceiling:58,confidence:40,hkb_value:0,metricCount:0});
const context=buildTeamContext(roster,[freeCatcher,lowInfo]);

assert.equal(DECISION_RULE_VERSION,"5.4.5");
assert.ok(Object.values(REASON_CODES).includes("POSITIONAL_NEED"));
assert.ok(context.positionWeakness.includes("C"),"thin catcher depth should register as a positional weakness");
assert.ok(context.positionSurplus.includes("OF"),"outfield depth should register as positional surplus");

const freeRec=recommendFreeAgent(freeCatcher,context);
assert.equal(freeRec.playerId,"fa-c");
assert.equal(freeRec.decisionRuleVersion,"5.4.5");
assert.ok(freeRec.reasonCodes.includes("POSITIONAL_NEED"));
assert.ok(["ADD","STASH","WATCH"].includes(freeRec.recommendation));

const lowInfoRec=recommendFreeAgent(lowInfo,context);
assert.ok(lowInfoRec.reasonCodes.includes("LOW_CONFIDENCE"));
assert.ok(lowInfoRec.reasonCodes.includes("INSUFFICIENT_DATA"));

const surplusRec=recommendRosterPlayer(surplusOf,context);
assert.ok(surplusRec.reasonCodes.includes("POSITIONAL_SURPLUS"));
assert.equal(surplusRec.recommendation,"CONSOLIDATE","a good player can be a consolidation asset");

const obviousCore=player({id:"r-core",name:"Obvious Core",positions:["OF"],owner_team_id:"team-1",roster_status:"ACTIVE",dynasty:61,impact:57,ceiling:72,hkb_value:2600});
const coreRec=recommendRosterPlayer(obviousCore,context);
assert.equal(coreRec.recommendation,"HOLD","premium market-value core players must not be labeled consolidation assets");
assert.ok(coreRec.reasonCodes.includes("CORE_ASSET_PROTECTION"));

const eliteProspect=player({id:"r-elite-pro",name:"Elite Prospect",positions:["SS"],owner_team_id:"team-1",roster_status:"MINORS",stage:"PROSPECT_DEVELOPMENTAL",dynasty:59,impact:38,ceiling:78,hkb_value:1200});
assert.equal(recommendRosterPlayer(eliteProspect,context).recommendation,"HOLD","premium prospects must be protected from positional-surplus consolidation");

const prospectRec=recommendRosterPlayer(prospect,context);
assert.notEqual(prospectRec.recommendation,"DROP_CANDIDATE","high-ceiling prospects should not be simple drop candidates");

const unclassifiedRec=recommendRosterPlayer(unclassified,context);
assert.ok(unclassifiedRec.reasonCodes.includes("UNCLASSIFIED_ROSTER_STATUS"));
assert.ok(unclassifiedRec.confidence<70,"unclassified roster status should lower recommendation confidence");

const renderedWaivers=renderWaiverOpportunities({positionOptions:["C"],mlbTeamOptions:["NYM"],waiverQuery:{page:1,pageSize:50}}, {recommendations:[freeRec,lowInfoRec],count:2,page:1,pageSize:50,decisionRuleVersion:"5.4.5"});
assert.match(renderedWaivers,/Waiver Opportunities/);
assert.match(renderedWaivers,/data-waiver-detail="fa-c"/);
assert.match(renderedWaivers,/data-waiver-upgrade="fa-c"/);
assert.match(renderedWaivers,/data-watch-player="fa-c"/);
assert.match(renderedWaivers,/in-session only/);
assert.match(renderedWaivers,/Immediate Adds|Watch List|Dynasty Stashes/);

const rosterHtml=renderMyRoster({teams:[{id:"team-1",name:"Aces"}],userTeamResolution:{teamId:"team-1"},rosterPlayers:roster,rosterRecommendations:{decisionRuleVersion:"5.4.5",recommendations:[surplusRec,prospectRec,unclassifiedRec]}});
assert.match(rosterHtml,/Refresh Recommendations/);
assert.match(rosterHtml,/Consolidation Assets/);
assert.match(rosterHtml,/Decision diagnostics/);

assert.match(service,/ownerTeamId:"FREE_AGENT"/,"waiver recommendations must query only unowned players");
assert.match(service,/ownerTeamId:teamId/,"roster recommendations must query selected-team players");
assert.match(service,/listPlayerIntelligence/,"stable pagination should flow through the player intelligence repository tie-breaker");
assert.match(service,/new Set\(\)/,"duplicate recommendations should be prevented");
assert.match(service,/hasPositionOverlap/,"upgrade comparison should respect position context");
assert.match(service,/freeAgentId:freeAgent\.id/,"upgrade comparison should preserve free-agent UUID");
assert.match(service,/playerId:player\.id/,"upgrade comparison should preserve rostered player UUID");
assert.doesNotMatch(service,/calculatePlayerScores|calculateLeagueScores/,"decision service must consume stored scores only");
assert.doesNotMatch(waiverView,/calculatePlayerScores|calculateLeagueScores|dynastyEngine/,"waiver view must not calculate scores directly");
assert.doesNotMatch(rosterViewSource,/calculatePlayerScores|calculateLeagueScores|dynastyEngine/,"roster view must not calculate scores directly");
assert.match(main,/waiverRequestId/,"stale waiver requests should be ignored");
assert.match(main,/nav\.dataset\.view==="waivers"\)updateWaiverPage/,"opening Waiver Opportunities should trigger a bounded waiver query");
assert.match(dataHealth,/Decision rule version/);
assert.match(dataHealth,/Free-agent recommendation owner check/);
assert.match(dataHealth,/Roster recommendation team check/);
assert.ok(String(findRosterUpgradeCandidates).includes("hasPositionOverlap"));

console.log("v5DecisionIntelligence tests passed");
