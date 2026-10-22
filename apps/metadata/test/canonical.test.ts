import assert from "node:assert/strict";
import test from "node:test";
import { canonicalBytes, canonicalize } from "../src/canonical.ts";

test("sorts all object keys independently of insertion order", () => {
  const first = { v: 1, name: "Coin", description: "", image: { width: 64, type: "image/png", sha256: "a".repeat(64), height: 64 } };
  const second = { image: { height: 64, sha256: "a".repeat(64), type: "image/png", width: 64 }, description: "", name: "Coin", v: 1 };
  assert.equal(canonicalize(first), canonicalize(second));
  assert.equal(canonicalize({ v: 1, name: "BunkerCoin", description: "", image: null }),
    '{"description":"","image":null,"name":"BunkerCoin","v":1}');
  assert.match(canonicalize(first), /"image":\{"height":64,"sha256":"a{64}","type":"image\/png","width":64\}/);
});

test("uses JSON string escaping and literal UTF-8 with no surrounding whitespace", () => {
  const value = { name: 'Café 🪙 "coin"\\', description: "a/b" };
  const expected = '{"description":"a/b","name":"Café 🪙 \\"coin\\"\\\\"}';
  assert.equal(canonicalize(value), expected);
  assert.deepEqual(canonicalBytes(value), new TextEncoder().encode(expected));
  assert.equal(canonicalize({ "2": true, "10": [null, 1, false] }), '{"10":[null,1,false],"2":true}');
});

test("rejects values outside JSON instead of silently dropping them", () => {
  for (const value of [undefined, NaN, Infinity, 1n, new Date(), { a: undefined }, new Array(1)]) {
    assert.throws(() => canonicalize(value), TypeError);
  }
});
