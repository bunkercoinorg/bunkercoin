export const BUNKER_DECIMALS = 6;

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatInteger(value: bigint): string {
  return value < 0n ? `-${group((-value).toString())}` : group(value.toString());
}

// Integer quotient/remainder so u64 base units never pass through a float.
export function formatUnits(units: bigint, decimals: number): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const base = 10n ** BigInt(decimals);
  const whole = group((abs / base).toString());
  const frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

export const formatBunker = (units: bigint) => formatUnits(units, BUNKER_DECIMALS);
