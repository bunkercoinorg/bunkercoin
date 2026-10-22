import {
  formatInteger,
  formatUnits as formatScaled,
  NATIVE_SCALE,
  parseUnits,
  relativeAge,
  shortId,
  TOKEN_SCALE,
} from '@bunkercoin/chain-format';

export { UNITS_PER_BUNKER, U64_MAX } from '@bunkercoin/chain-format';

/** 1234500000n -> "1,234.5" (BUNKER, trailing zeros trimmed). */
export const formatUnits = (units: bigint): string => formatScaled(units, NATIVE_SCALE, { trim: true });

/** Whole token counts: custom tokens have no decimals on-chain. */
export const formatCount = formatInteger;

/** "0.5" BUNKER -> 500000n units. Throws AmountError (spec copy) on malformed, sub-unit, zero or over-u64 input. */
export const parseBunker = (text: string): bigint => parseUnits(text, NATIVE_SCALE);

/** The amount field's parser: separators are stripped for whole token counts only, never around a BUNKER decimal. */
export const parseAmount = (text: string, scale: typeof NATIVE_SCALE | typeof TOKEN_SCALE): bigint =>
  scale === TOKEN_SCALE ? parseCount(text) : parseBunker(text);

/** "1,000 000" -> 1000000n. Whole positive numbers that fit a u64 only; separators are typing aids. */
export const parseCount = (text: string): bigint => parseUnits(String(text).replace(/[, ]/g, ''), TOKEN_SCALE);

/** `8Ep5…suHx`, hex `7ffcc7…52bf`; `chars` overrides both ends. */
export function shortAddress(address: string, chars?: number): string {
  if (chars === undefined) return shortId(address);
  if (!address || address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export const elapsedLabel = (sinceMs: number): string => relativeAge(sinceMs, Date.now());
