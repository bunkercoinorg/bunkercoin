import { deflateSync } from "node:zlib";

export function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

export function pngChunk(kind: string, payload = new Uint8Array(0)): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(12 + payload.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, payload.length);
  bytes.set(new TextEncoder().encode(kind), 4);
  bytes.set(payload, 8);
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
  return bytes;
}

export function png(width = 64, height = width, totalBytes?: number): Uint8Array<ArrayBuffer> {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  // A real zlib stream containing transparent RGBA scanlines with filter byte 0.
  const idat = pngChunk("IDAT", new Uint8Array(deflateSync(new Uint8Array(height * (width * 4 + 1)))));
  const header = concat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ihdr));
  const end = pngChunk("IEND");
  const padding = totalBytes === undefined ? new Uint8Array(0) :
    pngChunk("npAD", new Uint8Array(totalBytes - header.length - idat.length - end.length - 12));
  return concat(header, padding, idat, end);
}

export function webpChunk(kind: string, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(8 + payload.length + payload.length % 2);
  bytes.set(new TextEncoder().encode(kind));
  new DataView(bytes.buffer).setUint32(4, payload.length, true);
  bytes.set(payload, 8);
  return bytes;
}

export function riff(...chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const bytes = concat(new Uint8Array(12), ...chunks);
  bytes.set(new TextEncoder().encode("RIFF"));
  new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  return bytes;
}

export function webp(kind: "VP8 " | "VP8L" | "VP8X", width = 64, height = width): Uint8Array<ArrayBuffer> {
  const payload = new Uint8Array(kind === "VP8L" ? 5 : 10);
  const view = new DataView(payload.buffer);
  if (kind === "VP8 ") {
    payload.set([0x10, 0, 0, 0x9d, 0x01, 0x2a]);
    view.setUint16(6, width, true);
    view.setUint16(8, height, true);
  } else if (kind === "VP8L") {
    payload[0] = 0x2f;
    view.setUint32(1, ((height - 1) << 14) | (width - 1), true);
  } else {
    for (let index = 0; index < 3; index++) {
      payload[4 + index] = ((width - 1) >>> (index * 8)) & 0xff;
      payload[7 + index] = ((height - 1) >>> (index * 8)) & 0xff;
    }
    // Extended WebP must contain a real VP8/VP8L bitstream header after VP8X.
    return riff(webpChunk(kind, payload), webp("VP8L", width, height).subarray(12));
  }
  return riff(webpChunk(kind, payload));
}
