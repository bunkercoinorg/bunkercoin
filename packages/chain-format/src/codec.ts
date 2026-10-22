import { U64_MAX } from './units.ts';

/** Addresses, tx ids and block hashes are 32 bytes; token ids 4. */
export const HASH_BYTES = 32;
export const TOKEN_ID_BYTES = 4;

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

export function bytesToBase58(bytes: Uint8Array): string {
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

/** null on an empty string, a character outside the alphabet, or a decoded length other than `length`. */
export function base58ToBytes(s: string, length?: number): Uint8Array | null {
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
  return length === undefined || out.length === length ? out : null;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Either case in; null on odd length, non-hex, or a byte length other than `length`. */
export function hexToBytes(hex: string, length?: number): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  if (length !== undefined && hex.length !== length * 2) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(2 * k, 2 * k + 2), 16);
  return out;
}

/** Mirrors the node: exact-length hex wins, anything else is base58. */
export function decodeId(input: string, byteLength: number = HASH_BYTES): Uint8Array | null {
  const s = input.trim();
  if (s.length === byteLength * 2 && /^[0-9a-fA-F]+$/.test(s)) return hexToBytes(s);
  return base58ToBytes(s, byteLength);
}

/** Lowercase hex the REST layer keys on, or null. */
export function normalizeId(input: string, byteLength: number): string | null {
  const bytes = decodeId(input, byteLength);
  return bytes ? bytesToHex(bytes) : null;
}

export const normalizeHash = (input: string) => normalizeId(input, HASH_BYTES);

export const isAddress = (input: string): boolean => decodeId(input, HASH_BYTES) !== null;

/** Wallet display form of a 32-byte key given as hex; anything else is returned as-is. */
export function toBase58(hex: string): string {
  const bytes = hexToBytes(hex, HASH_BYTES);
  return bytes ? bytesToBase58(bytes) : hex;
}

/** Canonical token id: 8 lowercase hex characters, as the node encodes its 4 bytes. */
export function isTokenId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}$/.test(id);
}

export function normalizeTokenId(input: string): string | null {
  const s = input.trim();
  return /^[0-9a-fA-F]{8}$/.test(s) ? s.toLowerCase() : null;
}

export function formatTokenId(bytes: Uint8Array): string {
  if (bytes.length !== TOKEN_ID_BYTES) throw new RangeError('token id must be 4 bytes');
  return bytesToHex(bytes);
}

/** Decimal slot within u64, canonicalized (no leading zeros). */
export function normalizeSlot(input: string): string | null {
  const s = input.trim();
  if (!/^\d{1,20}$/.test(s)) return null;
  const n = BigInt(s);
  return n <= U64_MAX ? n.toString() : null;
}
