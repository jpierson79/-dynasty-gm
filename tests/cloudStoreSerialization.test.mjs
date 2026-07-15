import assert from "node:assert/strict";
import { serializeMlbamId } from "../js/services/cloudStore.js";

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

console.log("cloudStoreSerialization tests passed");
