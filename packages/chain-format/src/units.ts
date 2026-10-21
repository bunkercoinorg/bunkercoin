/** Native BUNKER has 6 decimals (1 base unit = 1 µBUNKER, the RPC's `lamports`); custom tokens are whole units. */
export const NATIVE_SCALE = 6;
export const TOKEN_SCALE = 0;
export const UNITS_PER_BUNKER = 1_000_000n;
export const U64_MAX = (1n << 64n) - 1n;

export type Scale = typeof NATIVE_SCALE | typeof TOKEN_SCALE;

export type AmountErrorCode = 'invalid' | 'decimals' | 'whole' | 'range';

const COPY: Record<AmountErrorCode, string> = {
  invalid: 'Enter an amount above 0.',
  decimals: 'BUNKER allows up to 6 decimals.',
  whole: 'Tokens use whole units.',
  range: 'that is more than a u64 can hold.',
};

export class AmountError extends Error {
  readonly code: AmountErrorCode;
  constructor(code: AmountErrorCode) {
    super(COPY[code]);
    this.name = 'AmountError';
    this.code = code;
  }
}

/** "12.5" at scale 6 -> 12_500_000n. Positive, at most `scale` decimals, within u64; throws AmountError. */
export function parseUnits(text: string, scale: Scale): bigint {
  const s = String(text).trim();
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new AmountError(scale === TOKEN_SCALE && /^\d+\.\d*$/.test(s) ? 'whole' : 'invalid');
  const [, whole, frac = ''] = m;
  if (frac.length > scale) throw new AmountError(scale === TOKEN_SCALE ? 'whole' : 'decimals');
  const units = BigInt(whole) * 10n ** BigInt(scale) + BigInt(frac.padEnd(scale, '0') || '0');
  if (units <= 0n) throw new AmountError('invalid');
  if (units > U64_MAX) throw new AmountError('range');
  return units;
}

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Integer quotient/remainder so u64 base units never pass through a float. */
export function formatUnits(units: bigint, scale: number, { group: grouped = true, trim = false } = {}): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const base = 10n ** BigInt(scale);
  const whole = (abs / base).toString();
  let frac = scale > 0 ? (abs % base).toString().padStart(scale, '0') : '';
  if (trim) frac = frac.replace(/0+$/, '');
  return `${neg ? '-' : ''}${grouped ? group(whole) : whole}${frac ? `.${frac}` : ''}`;
}

export function formatInteger(value: bigint): string {
  return formatUnits(value, 0);
}
