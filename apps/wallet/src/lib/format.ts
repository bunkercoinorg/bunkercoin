// 1 base unit = 1 µBUNKER (the RPC calls the field `lamports`).
export const UNITS_PER_BUNKER = 1_000_000n;
const DECIMALS = 6;
export const U64_MAX = (1n << 64n) - 1n;

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 1234500000n -> "1,234.5" (BUNKER, trailing zeros trimmed). */
export function formatUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = group((abs / UNITS_PER_BUNKER).toString());
  const frac = (abs % UNITS_PER_BUNKER).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** Whole token counts: custom tokens have no decimals on-chain. */
export function formatCount(count: bigint): string {
  return count < 0n ? `-${group((-count).toString())}` : group(count.toString());
}

/** "0.5" BUNKER -> 500000n units. Throws on malformed, sub-unit, zero or over-u64 input. */
export function parseBunker(text: string): bigint {
  const trimmed = String(text).trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Enter a positive amount');
  const [whole, frac = ''] = trimmed.split('.');
  if (frac.length > DECIMALS) throw new Error('Smallest unit is 0.000001 BUNKER');
  const units = BigInt(whole) * UNITS_PER_BUNKER + BigInt(frac.padEnd(DECIMALS, '0'));
  if (units <= 0n) throw new Error('Enter a positive amount');
  if (units > U64_MAX) throw new Error('Amount too large');
  return units;
}

/** "1,000 000" -> 1000000n. Whole positive numbers that fit a u64 only. */
export function parseCount(text: string): bigint {
  const cleaned = String(text).replace(/[, ]/g, '');
  if (!/^\d+$/.test(cleaned)) throw new Error('Enter a whole number');
  const value = BigInt(cleaned);
  if (value <= 0n) throw new Error('Enter a whole number');
  if (value > U64_MAX) throw new Error('That number is too large');
  return value;
}

export function shortAddress(address: string, chars = 4): string {
  if (!address || address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function elapsedLabel(sinceMs: number): string {
  const s = Math.floor((Date.now() - sinceMs) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
