import assert from "node:assert/strict";
import test from "node:test";
import { validateDocument, ValidationError } from "../src/validate.ts";

const document = { v: 1, name: "Coin", description: "", image: null };
const image = { sha256: "ab".repeat(32), type: "image/png", width: 64, height: 64 };

test("accepts document boundaries, NFC and Unicode code point lengths", () => {
  assert.deepEqual(validateDocument(document), document);
  assert.equal(validateDocument({ ...document, name: "🪙".repeat(48), description: "é".repeat(280) }).name.length, 96);
  for (const size of [64, 512]) {
    for (const type of ["image/png", "image/webp"]) {
      const value = { ...document, image: { ...image, type, width: size, height: size } };
      assert.deepEqual(validateDocument(value), value);
    }
  }
});

test("rejects missing and unknown document or image keys and unsupported versions", () => {
  const { description, ...missing } = document;
  for (const value of [null, [], "text", missing, { ...document, token_id: "x" },
    { ...document, v: 2 }, { ...document, v: "1" }, { ...document, image: undefined },
    { ...document, image: { ...image, extra: true } },
    { ...document, image: { type: "image/png", width: 64, height: 64 } }]) {
    assert.throws(() => validateDocument(value), ValidationError);
  }
});

test("rejects invalid strings without silently trimming or normalizing", () => {
  for (const name of ["", "a".repeat(49), "🪙".repeat(49), "e\u0301", "x\n", "\0", "\u007f", "\u0085", "\ud800", "\udfff", 4, null]) {
    assert.throws(() => validateDocument({ ...document, name }), ValidationError);
  }
  for (const description of ["a".repeat(281), "e\u0301", "tab\t", null, 0]) {
    assert.throws(() => validateDocument({ ...document, description }), ValidationError);
  }
});

test("rejects malformed image descriptors", () => {
  for (const input of [{ ...image, sha256: "A".repeat(64) }, { ...image, sha256: "0".repeat(63) },
    { ...image, sha256: "g".repeat(64) }, { ...image, type: "image/svg+xml" },
    { ...image, width: 63, height: 63 }, { ...image, width: 513, height: 513 },
    { ...image, width: 64.5, height: 64.5 }, { ...image, height: 65 },
    { ...image, width: "64" }, { ...image, width: NaN }, []]) {
    assert.throws(() => validateDocument({ ...document, image: input }), ValidationError);
  }
});
