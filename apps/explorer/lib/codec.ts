const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let k = zeros; k < bytes.length; k++) {
    let carry = bytes[k];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '1'.repeat(zeros);
  for (let k = digits.length - 1; k >= 0; k--) out += ALPHABET[digits[k]];
  return out;
}

export function base58Decode(s: string): Uint8Array | null {
  if (!s) return null;
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  const bytes: number[] = [];
  for (let k = zeros; k < s.length; k++) {
    const v = INDEX.get(s[k]);
    if (v === undefined) return null;
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let k = 0; k < bytes.length; k++) out[out.length - 1 - k] = bytes[k];
  return out;
}

export function hexEncode(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function hexDecode(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(2 * k, 2 * k + 2), 16);
  return out;
}

// Mirrors the node's decoding: exact-length hex wins, anything else is base58.
// Returns the lowercase hex the REST layer keys on, or null on a length mismatch.
export function normalizeId(input: string, byteLength: number): string | null {
  const s = input.trim();
  if (s.length === byteLength * 2 && /^[0-9a-fA-F]+$/.test(s)) return s.toLowerCase();
  const bytes = base58Decode(s);
  return bytes && bytes.length === byteLength ? hexEncode(bytes) : null;
}

export const HASH_BYTES = 32;
export const TOKEN_ID_BYTES = 4;

export const normalizeHash = (input: string) => normalizeId(input, HASH_BYTES);

export function normalizeTokenId(input: string): string | null {
  const s = input.trim();
  return /^[0-9a-fA-F]{8}$/.test(s) ? s.toLowerCase() : null;
}

// Wallet-facing display form of a 32-byte key; anything else is shown as-is.
export function toBase58(hex: string): string {
  const bytes = hex.length === HASH_BYTES * 2 ? hexDecode(hex) : null;
  return bytes ? base58Encode(bytes) : hex;
}

const U64_MAX = (1n << 64n) - 1n;

// Decimal slot number within u64, canonicalized (no leading zeros).
export function normalizeSlot(input: string): string | null {
  const s = input.trim();
  if (!/^\d{1,20}$/.test(s)) return null;
  const n = BigInt(s);
  return n <= U64_MAX ? n.toString() : null;
}
