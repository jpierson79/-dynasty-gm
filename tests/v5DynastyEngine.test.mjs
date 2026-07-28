import assert from "node:assert/strict";
import { calculateLeagueScores, calculatePlayerScores, ENGINE_VERSION, scoreRow } from "../v5/js/engine/dynastyEngine.js";
import { ageCurveScore } from "../v5/js/engine/modules/ageCurve.js";
import { overallScore } from "../v5/js/engine/modules/overallScore.js";

const leagueId="11111111-1111-4111-8111-111111111111";
const players=[
  {id:"p-1",league_id:leagueId,name:"Young Catcher",age:24,hkb_value:72,positions:["C"],fantrax_id:"FTX-1",mlbam_id:null,owner_team_id:"t-1",roster_status:"ACTIVE"},
  {id:"p-2",league_id:leagueId,name:"Older First",age:34,hkb_value:48,positions:["1B"],fantrax_id:"FTX-2",mlbam_id:123,owner_team_id:null,roster_status:"FREE_AGENT"},
  {id:"p-3",league_id:leagueId,name:"Pitcher",age:27,hkb_value:64,positions:["SP"],fantrax_id:"FTX-3",mlbam_id:456,owner_team_id:"t-1",roster_status:"RESERVE"}
];
const metrics=[
  {player_id:"p-1",metrics:{xwoba:.370,hard_hit_percent:48,barrel_batted_rate:12},imported_at:"2026-01-01T00:00:00Z"},
  {player_id:"p-3",metrics:{xera:3.4,hard_hit_percent:35},imported_at:"2026-01-01T00:00:00Z"}
];

function repositories(calls){
  return {
    players:{allPlayers:async()=>players},
    metrics:{listMetrics:async()=>metrics},
    leagues:{leagueById:async()=>({id:leagueId,settings:{scoringType:"Head-to-Head Points"}})},
    scores:{upsertScores:async rows=>{calls.push(rows);return rows.map((row,index)=>({...row,id:`score-${calls.length}-${index}`}))}}
  };
}

assert.equal(ENGINE_VERSION,"5.1.1");
assert.equal(ageCurveScore({player:{age:24}}),96);
assert.equal(ageCurveScore({player:{age:34}}),42);

const oneScores=calculatePlayerScores({player:players[0],metrics:metrics[0].metrics,leagueSettings:{scoringType:"Head-to-Head Points"}});
const twoScores=calculatePlayerScores({player:players[0],metrics:metrics[0].metrics,leagueSettings:{scoringType:"Head-to-Head Points"}});
assert.deepEqual(oneScores,twoScores,"module output should be deterministic for identical inputs");
assert.equal(oneScores.overall_score,overallScore(oneScores),"overall score combines module outputs deterministically");
assert.equal(oneScores.overall_score_version,ENGINE_VERSION);

const row=scoreRow({leagueId,player:players[0],scores:oneScores,calculatedAt:"2026-07-27T00:00:00.000Z"});
assert.equal(row.player_id,players[0].id);
assert.equal(row.score_version,ENGINE_VERSION);
assert.equal(row.explanation.scores.buy_low_score,oneScores.buy_low_score);
assert.equal(row.explanation.scores.sell_high_score,oneScores.sell_high_score);
assert.equal(row.explanation.metadata.player_stage,oneScores.metadata.player_stage);
assert.ok(Number.isFinite(row.explanation.scores.confidence_score));

{
  const calls=[],progress=[];
  const result=await calculateLeagueScores(leagueId,{repositories:repositories(calls),batchSize:2,onProgress:p=>progress.push(p)});
  assert.equal(result.processed,3);
  assert.equal(result.updated,3);
  assert.equal(result.engineVersion,ENGINE_VERSION);
  assert.equal(calls.length,2,"batch processing should split writes by batchSize");
  assert.deepEqual(calls.flat().map(item=>item.player_id),players.map(player=>player.id),"score writes preserve player UUIDs");
  assert.ok(progress.some(p=>p.stage==="batch"));
}

{
  const calls=[];
  await calculateLeagueScores(leagueId,{repositories:repositories(calls),batchSize:2});
  await calculateLeagueScores(leagueId,{repositories:repositories(calls),batchSize:2});
  assert.equal(calls.length,4,"rerun/retry uses repeat upserts instead of inserts to another table");
  assert.ok(calls.flat().every(row=>row.score_version===ENGINE_VERSION),"engine version stored on every row");
}

{
  const calls=[];
  let count=0;
  await assert.rejects(
    calculateLeagueScores(leagueId,{repositories:repositories(calls),batchSize:1,cancelled:()=>++count>2}),
    error=>error.cancelled===true
  );
  assert.equal(calls.length,1,"cancel stops before later batches");
}

console.log("v5DynastyEngine tests passed");
