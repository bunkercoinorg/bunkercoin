import assert from "node:assert/strict";
import test from "node:test";
import { metadataHash, sha256 } from "../src/hash.ts";
import { canonicalize } from "../src/canonical.ts";

test("matches SHA-256 fixed vectors for raw bytes and strings", async () => {
  assert.equal(await sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(await sha256(new Uint8Array([97, 98, 99])), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("matches the fixed canonical metadata vector regardless of key order", async () => {
  const hash = "3fac357e74836eeb1811034d4c8b7381c54421ab04e73a6134d5cb7fe745d4fb";
  assert.equal(await metadataHash({ v: 1, name: "BunkerCoin", description: "", image: null }), hash);
  assert.equal(await metadataHash({ image: null, description: "", name: "BunkerCoin", v: 1 }), hash);
  assert.notEqual(await metadataHash({ v: 1, name: "Bunkercoin", description: "", image: null }), hash);
});

test("validates documents before hashing", async () => {
  await assert.rejects(async () => metadataHash({ v: 1, name: "e\u0301", description: "", image: null }));
  await assert.rejects(async () => metadataHash({ v: 1, name: "Coin", description: "", image: null, token_id: "x" }));
});

test("matches the fixed Unicode metadata vector with an image", async () => {
  const document = {
    v: 1, name: "Café", description: "Épargne / 東京 🪙",
    image: { width: 64, height: 64, type: "image/png", sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
  };
  const canonical = '{"description":"Épargne / 東京 🪙","image":{"height":64,"sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","type":"image/png","width":64},"name":"Café","v":1}';
  // Independently computed with Python hashlib.sha256 over the literal UTF-8 bytes.
  const hash = "a3c65791af5a7d5ddbbd5d943c33abb77c1780f71e9417646be087870e7b2407";
  assert.equal(canonicalize(document), canonical);
  assert.equal(await metadataHash(document), hash);
});
