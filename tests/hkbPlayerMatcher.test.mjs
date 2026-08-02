import assert from "node:assert/strict";
import { createHkbPlayerMatcher, HKB_DIAGNOSTIC, isHkbDraftPickAsset, normalizeHkbPlayerName, normalizeHkbTeam, summarizeHkbClassifications } from "../js/services/hkbPlayerMatcher.js";

const player=(id,name,team,positions,extra={})=>({id,name,mlb_team:team,positions,owner_team_id:extra.owner_team_id||null,roster_status:extra.roster_status||"UNCLASSIFIED",fantrax_id:extra.fantrax_id||""});

assert.equal(normalizeHkbPlayerName("Julio Rodríguez"),normalizeHkbPlayerName("Julio Rodriguez"));
assert.equal(normalizeHkbPlayerName("José Ramírez"),normalizeHkbPlayerName("Jose Ramirez"));
assert.equal(normalizeHkbPlayerName("Edwin Díaz"),normalizeHkbPlayerName("Edwin Diaz"));
assert.equal(normalizeHkbPlayerName("Riley O'Brien"),normalizeHkbPlayerName("Riley OBrien"));
assert.equal(normalizeHkbPlayerName("C.J. Kayfus"),normalizeHkbPlayerName("CJ Kayfus"));
assert.equal(normalizeHkbPlayerName("J.D. Martinez"),normalizeHkbPlayerName("JD Martinez"));
assert.equal(normalizeHkbPlayerName("Michael A. Taylor"),normalizeHkbPlayerName("Michael A Taylor"));
assert.equal(normalizeHkbPlayerName("Elmer Rodriguez-Cruz"),normalizeHkbPlayerName("Elmer Rodriguez Cruz"));
assert.equal(normalizeHkbPlayerName("Luis Garcia Jr."),"luis garcia jr");
assert.notEqual(normalizeHkbPlayerName("Luis Garcia Jr."),normalizeHkbPlayerName("Luis Garcia"),"Suffixes must remain meaningful tokens");
assert.equal(normalizeHkbTeam("OAK"),"ATH");
assert.equal(normalizeHkbTeam("SDP"),"SD");

assert.equal(isHkbDraftPickAsset("2027 Early 1st"),true);
assert.equal(isHkbDraftPickAsset("2028 Late 3rd"),true);
assert.equal(isHkbDraftPickAsset("Player 2027 Early 1st"),false);
assert.equal(isHkbDraftPickAsset("2027 1st"),false);

const players=[
  player("julio","Julio Rodríguez","SEA",["OF"]),
  player("jose","José Ramírez","CLE",["3B"]),
  player("edwin","Edwin Díaz","LAD",["RP"]),
  player("riley","Riley O'Brien","STL",["RP"]),
  player("kayfus","CJ Kayfus","CLE",["1B","OF"]),
  player("jd","JD Martinez","NYM",["UT"]),
  player("taylor","Michael A Taylor","FA",["OF"]),
  player("elmer","Elmer Rodriguez Cruz","NYY",["SP"]),
  player("luis-jr","Luis Garcia Jr","WSH",["1B","2B"]),
  player("luis","Luis Garcia","PHI",["SS"]),
  player("muncy-ath","Max Muncy","ATH",["2B","3B"]),
  player("muncy-lad","Max Muncy","LAD",["3B"]),
  player("flores-det","Wilmer Flores","",["RP"]),
  player("flores-sf","Wilmer Flores","",["1B"]),
  player("cruz-nyy","Fernando Cruz","NYY",["RP"]),
  player("cruz-chc","Fernando Cruz","CHC",["SS"]),
  player("smith-lad","Will Smith","LAD",["C"]),
  player("smith-tex","Will Smith","TEX",["RP"])
];
const match=createHkbPlayerMatcher(players);

for(const [source,id] of [["Julio Rodriguez","julio"],["Jose Ramirez","jose"],["Edwin Diaz","edwin"],["Riley OBrien","riley"],["C.J. Kayfus","kayfus"],["J.D. Martinez","jd"],["Michael A. Taylor","taylor"],["Elmer Rodriguez-Cruz","elmer"],["Luis Garcia Jr.","luis-jr"]]){
  const result=match({name:source});
  assert.equal(result.status,"matched",source);
  assert.equal(result.player.id,id,source);
}

for(const [row,id] of [
  [{name:"Max Muncy",team:"ATH",positions:"2B/3B"},"muncy-ath"],
  [{name:"Max Muncy",team:"LAD",positions:"3B"},"muncy-lad"],
  [{name:"Wilmer Flores",team:"DET",positions:"RP"},"flores-det"],
  [{name:"Wilmer Flores",team:"FA",positions:"1B"},"flores-sf"],
  [{name:"Fernando Cruz",team:"NYY",positions:"RP"},"cruz-nyy"],
  [{name:"Fernando Cruz",team:"CHC",positions:"SS"},"cruz-chc"],
  [{name:"Will Smith",team:"LAD",positions:"C"},"smith-lad"]
]){
  const result=match(row);
  assert.equal(result.category,HKB_DIAGNOSTIC.SAFE_CONTEXTUAL_MATCH_AVAILABLE);
  assert.equal(result.player.id,id);
}

assert.equal(match({name:"Will Smith"}).category,HKB_DIAGNOSTIC.AMBIGUOUS_NAME);
assert.equal(match({name:"Will Smith",team:"SEA",positions:"C"}).category,HKB_DIAGNOSTIC.CONTEXT_CONFLICT);
assert.equal(match({name:"Julio Rodriquez"}).category,HKB_DIAGNOSTIC.PLAYER_ABSENT_FROM_CLOUD,"No fuzzy matching is allowed");
assert.equal(match({name:"2027 Early 1st"}).category,HKB_DIAGNOSTIC.NON_PLAYER_ASSET);
assert.equal(match({name:""}).category,HKB_DIAGNOSTIC.INVALID_SOURCE_ROW);

const summary=summarizeHkbClassifications([
  match({name:"Julio Rodriguez"}),
  match({name:"Max Muncy",team:"ATH",positions:"3B"}),
  match({name:"Will Smith"}),
  match({name:"Absent Player"}),
  match({name:"2028 Late 3rd"})
]);
assert.deepEqual(summary,{totalSourceRows:5,playerRows:4,nonPlayerAssets:1,stableIdMatches:0,uniqueNormalizedNameMatches:1,contextualMatches:1,ambiguousRows:1,normalizationMismatches:1,playersAbsentFromCloud:1,invalidRows:0,unmatchedRows:2,contextConflicts:0});

console.log("hkbPlayerMatcher tests passed");
