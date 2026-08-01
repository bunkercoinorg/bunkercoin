// 1 base unit = 1 µBUNKER (the RPC calls the field `lamports`).
export const UNITS_PER_BUNKER = 1_000_000;

export function formatUnits(units) {
  const value = Number(units) / UNITS_PER_BUNKER;
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** "0.5" BUNKER -> 500000 units. Throws on malformed or sub-unit input. */
export function parseBunker(text) {
  const trimmed = String(text).trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Enter a positive amount');
  const [whole, frac = ''] = trimmed.split('.');
  if (frac.length > 6) throw new Error('Smallest unit is 0.000001 BUNKER');
  const units = BigInt(whole) * BigInt(UNITS_PER_BUNKER) + BigInt(frac.padEnd(6, '0') || '0');
  if (units <= 0n) throw new Error('Enter a positive amount');
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount too large');
  return Number(units);
}

export function shortAddress(address, chars = 4) {
  if (!address || address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function elapsedLabel(sinceMs) {
  const s = Math.floor((Date.now() - sinceMs) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
