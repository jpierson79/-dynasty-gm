import assert from "node:assert/strict";
import { prepareResolvedPlayerUpdateRows, serializeMlbamId, stripPlayerUpdateRow } from "../js/services/cloudStore.js";

assert.equal(serializeMlbamId(null),null);
assert.equal(serializeMlbamId(undefined),null);
assert.equal(serializeMlbamId(""),null);
assert.equal(serializeMlbamId("0"),null);
assert.equal(serializeMlbamId(0),null);
assert.equal(serializeMlbamId(Number.NaN),null);
assert.equal(serializeMlbamId("null"),null);
assert.equal(serializeMlbamId("undefined"),null);
assert.equal(serializeMlbamId("abc"),null);
assert.equal(serializeMlbamId("12.3"),null);
assert.equal(serializeMlbamId("-12"),null);
assert.equal(serializeMlbamId("9007199254740992"),null);
assert.equal(serializeMlbamId(12345),12345);
assert.equal(serializeMlbamId(" 12345 "),12345);
assert.equal(serializeMlbamId("0012345"),12345);

assert.deepEqual(stripPlayerUpdateRow({id:"existing-id",fantrax_id:"",mlbam_id:"",name:"Blank IDs"}),{name:"Blank IDs"});
assert.deepEqual(stripPlayerUpdateRow({fantrax_id:"   ",mlbam_id:"0",name:"Zero MLBAM"}),{name:"Zero MLBAM"});
assert.deepEqual(stripPlayerUpdateRow({fantrax_id:null,mlbam_id:"abc",name:"Bad MLBAM"}),{name:"Bad MLBAM"});
assert.deepEqual(stripPlayerUpdateRow({fantrax_id:" FTX-1 ",mlbam_id:"0012345",name:"Valid IDs"}),{fantrax_id:"FTX-1",mlbam_id:12345,name:"Valid IDs"});

assert.deepEqual(
  prepareResolvedPlayerUpdateRows(
    [{id:"player-1",league_id:"league-1",hkb_value:5000,overall_rank:1}],
    [{id:"player-1",league_id:"league-1",name:"Existing Player",normalized_name:"existing player"}]
  ),
  [{id:"player-1",league_id:"league-1",name:"Existing Player",normalized_name:"existing player",hkb_value:5000,overall_rank:1}],
  "partial updates must carry the existing required identity fields through the batch upsert"
);
assert.throws(
  ()=>prepareResolvedPlayerUpdateRows([{id:"missing",league_id:"league-1",hkb_value:1}],[]),
  /not found or is not accessible/,
  "a resolved update must never turn into an insert when its UUID is missing"
);
assert.throws(
  ()=>prepareResolvedPlayerUpdateRows(
    [{id:"player-1",league_id:"league-2",hkb_value:1}],
    [{id:"player-1",league_id:"league-1",name:"Existing Player",normalized_name:"existing player"}]
  ),
  /league mismatch/,
  "resolved updates must remain in their reviewed league"
);

console.log("cloudStoreSerialization tests passed");
