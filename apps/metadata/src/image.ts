import { ValidationError } from "./validate.ts";

export const MAX_IMAGE_BYTES = 256 * 1024;

export interface ImageInfo {
  type: "image/png" | "image/webp";
  width: number;
  height: number;
}

function tag(bytes: Uint8Array, offset: number, text: string): boolean {
  return [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

function invalid(): never {
  throw new ValidationError("Invalid static PNG or WebP image");
}

function dimensions(type: ImageInfo["type"], width: number, height: number): ImageInfo {
  if (width !== height || width < 64 || width > 512) {
    throw new ValidationError("Image must be square and 64-512 pixels");
  }
  return { type, width, height };
}

export function inspectImage(bytes: Uint8Array): ImageInfo {
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new ValidationError("Image exceeds 256 KiB");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.every((byte, index) => bytes[index] === byte)) {
    let offset = 8;
    let result: ImageInfo | undefined;
    let hasData = false;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) invalid();
      const size = view.getUint32(offset);
      const start = offset + 8;
      const next = start + size + 4; // Include the chunk CRC.
      if (next > bytes.length || tag(bytes, offset + 4, "acTL")) invalid();
      if (offset === 8) {
        if (size !== 13 || !tag(bytes, offset + 4, "IHDR")) invalid();
        result = dimensions("image/png", view.getUint32(start), view.getUint32(start + 4));
      } else if (tag(bytes, offset + 4, "IHDR")) {
        invalid();
      } else if (tag(bytes, offset + 4, "IDAT")) {
        if (size > 0) hasData = true;
      } else if (tag(bytes, offset + 4, "IEND")) {
        if (size !== 0 || !result || !hasData || next !== bytes.length) invalid();
        return result;
      }
      offset = next;
    }
    invalid();
  }
  if (bytes.length < 20 || !tag(bytes, 0, "RIFF") || !tag(bytes, 8, "WEBP") ||
      view.getUint32(4, true) + 8 !== bytes.length) invalid();

  let canvas: ImageInfo | undefined;
  let frame: ImageInfo | undefined;
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) invalid();
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const next = start + size + (size % 2);
    if (next > bytes.length || tag(bytes, offset, "ANIM") || tag(bytes, offset, "ANMF")) invalid();
    const vp8 = tag(bytes, offset, "VP8 ");
    const vp8l = tag(bytes, offset, "VP8L");
    const vp8x = tag(bytes, offset, "VP8X");
    if (offset === 12 && !vp8 && !vp8l && !vp8x) invalid();
    if (vp8x) {
      if (offset !== 12 || size !== 10 || (bytes[start] & 0xc3) !== 0 ||
          bytes[start + 1] !== 0 || bytes[start + 2] !== 0 || bytes[start + 3] !== 0) invalid();
      const width = 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16);
      const height = 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16);
      canvas = dimensions("image/webp", width, height);
    } else if (vp8l || vp8) {
      if (frame) invalid();
      if (vp8l) {
        if (size < 5 || bytes[start] !== 0x2f || (bytes[start + 4] & 0xe0) !== 0) invalid();
        const bits = view.getUint32(start + 1, true);
        frame = dimensions("image/webp", (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      } else {
        if (size < 10 || (bytes[start] & 1) !== 0 || bytes[start + 3] !== 0x9d ||
            bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) invalid();
        frame = dimensions("image/webp", view.getUint16(start + 6, true) & 0x3fff,
          view.getUint16(start + 8, true) & 0x3fff);
      }
    }
    offset = next;
  }
  if (!frame || (canvas && (canvas.width !== frame.width || canvas.height !== frame.height))) invalid();
  return frame;
}
