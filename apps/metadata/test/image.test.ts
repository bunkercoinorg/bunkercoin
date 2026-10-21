import assert from "node:assert/strict";
import test from "node:test";
import { inspectImage, MAX_IMAGE_BYTES } from "../src/image.ts";
import { ValidationError } from "../src/validate.ts";
import { concat, png, pngChunk, riff, webp, webpChunk } from "./fixtures.ts";

test("reads PNG IHDR dimensions including a nonzero byteOffset", () => {
  const bytes = png(512);
  const padded = new Uint8Array(bytes.length + 10);
  padded.set(bytes, 5);
  assert.deepEqual(inspectImage(padded.subarray(5, 5 + bytes.length)), { type: "image/png", width: 512, height: 512 });
});

for (const kind of ["VP8 ", "VP8L", "VP8X"] as const) {
  test(`reads WebP ${kind.trim()} dimensions and rejects invalid sizes`, () => {
    for (const size of [64, 256, 512]) {
      assert.deepEqual(inspectImage(webp(kind, size)), { type: "image/webp", width: size, height: size });
    }
    for (const [width, height] of [[63, 63], [513, 513], [64, 65]]) {
      assert.throws(() => inspectImage(webp(kind, width, height)), ValidationError);
    }
    const bytes = webp(kind);
    for (let length = 0; length < bytes.length; length++) {
      assert.throws(() => inspectImage(bytes.subarray(0, length)), ValidationError);
    }
  });
}

test("rejects PNG truncation, invalid IHDR and non-square or oversized dimensions", () => {
  const bytes = png();
  for (let length = 0; length < bytes.length; length++) {
    assert.throws(() => inspectImage(bytes.subarray(0, length)), ValidationError);
  }
  for (const index of [0, 11, 12]) {
    const corrupt = png();
    corrupt[index] ^= 1;
    assert.throws(() => inspectImage(corrupt), ValidationError);
  }
  for (const input of [png(0), png(63), png(513), png(64, 65)]) {
    assert.throws(() => inspectImage(input), ValidationError);
  }
});

test("rejects malformed WebP signatures, sizes, versions and frame headers", () => {
  for (const [kind, index] of [["VP8 ", 20], ["VP8 ", 23], ["VP8L", 20], ["VP8L", 24], ["VP8X", 20], ["VP8X", 21]] as const) {
    const bytes = webp(kind);
    bytes[index] ^= kind === "VP8L" && index === 24 ? 0xe0 : 1;
    assert.throws(() => inspectImage(bytes), ValidationError);
  }
  for (const index of [0, 4, 8, 12, 16]) {
    const bytes = webp("VP8X");
    bytes[index] ^= 1;
    assert.throws(() => inspectImage(bytes), ValidationError);
  }
  const trailing = new Uint8Array(webp("VP8X").length + 2);
  trailing.set(webp("VP8X"));
  new DataView(trailing.buffer).setUint32(4, trailing.length - 8, true);
  assert.throws(() => inspectImage(trailing), ValidationError);
});

test("enforces the image byte limit and rejects other formats", () => {
  const bytes = png(64, 64, MAX_IMAGE_BYTES);
  assert.equal(inspectImage(bytes).type, "image/png");
  const oversized = new Uint8Array(MAX_IMAGE_BYTES + 1);
  oversized.set(png());
  for (const value of [oversized, new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    new TextEncoder().encode("GIF89a"), new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]) {
    assert.throws(() => inspectImage(value), ValidationError);
  }
});

test("requires PNG IHDR first, nonempty IDAT and a terminal IEND", () => {
  const bytes = png();
  const header = bytes.subarray(0, 33);
  const idat = bytes.subarray(33, -12);
  const end = pngChunk("IEND");
  for (const invalid of [
    header,
    concat(header, end),
    concat(header, pngChunk("IDAT"), end),
    concat(header, idat),
    concat(bytes.subarray(0, 8), idat, header.subarray(8), end),
    concat(header, header.subarray(8), idat, end),
    concat(bytes, new Uint8Array([0])),
    concat(header, idat, pngChunk("IEND", new Uint8Array([0]))),
  ]) assert.throws(() => inspectImage(invalid), ValidationError);
});

test("rejects APNG chunks before and after IDAT", () => {
  const bytes = png();
  const animation = pngChunk("acTL", new Uint8Array(8));
  for (const offset of [33, bytes.length - 12]) {
    assert.throws(() => inspectImage(concat(bytes.subarray(0, offset), animation, bytes.subarray(offset))), ValidationError);
  }
});

test("extended WebP requires a frame matching its canvas", () => {
  const extended = webp("VP8X");
  const canvas = extended.subarray(12, 30);
  assert.throws(() => inspectImage(riff(canvas)), ValidationError);
  assert.throws(() => inspectImage(riff(canvas, webpChunk("JUNK", new Uint8Array(4)))), ValidationError);
  assert.throws(() => inspectImage(riff(canvas, webp("VP8L", 128).subarray(12))), ValidationError);
  const corruptFrame = extended.slice();
  corruptFrame[38] = 0; // VP8L bitstream signature, after the VP8X canvas.
  assert.throws(() => inspectImage(corruptFrame), ValidationError);
  assert.equal(inspectImage(riff(canvas, webp("VP8 ").subarray(12))).width, 64);
});

test("rejects animated WebP flags and chunks anywhere", () => {
  const animated = webp("VP8X");
  animated[20] |= 0x02;
  assert.throws(() => inspectImage(animated), ValidationError);
  for (const kind of ["ANIM", "ANMF"]) {
    const chunk = webpChunk(kind, new Uint8Array(6));
    for (const frame of [webp("VP8L"), webp("VP8X")]) {
      assert.throws(() => inspectImage(riff(frame.subarray(12), chunk)), ValidationError);
    }
  }
});

test("simple WebP requires the first chunk to contain its bitstream", () => {
  const chunk = webpChunk("JUNK", new Uint8Array(2));
  for (const kind of ["VP8 ", "VP8L"] as const) {
    assert.throws(() => inspectImage(riff(chunk, webp(kind).subarray(12))), ValidationError);
  }
});
