import { AmountError, formatUnits, NATIVE_SCALE, TOKEN_SCALE } from '@bunkercoin/chain-format';
import type { TokenBalance } from './connection.ts';
import { parseAmount } from './format.ts';

/** What the send flow moves, frozen at pick time so a later poll can never change it. */
export type SendAsset =
  | { kind: 'native'; unit: 'BUNKER'; scale: typeof NATIVE_SCALE }
  | { kind: 'token'; tokenId: string; ticker: string | null; metadataHash: string | null; unit: string; scale: typeof TOKEN_SCALE };

export const NATIVE_SEND: SendAsset = { kind: 'native', unit: 'BUNKER', scale: NATIVE_SCALE };

export const TOKEN_GONE = 'That token is no longer in this wallet.';

/** `RADIO · 01000000`: tokens always show ticker and id, so a token ticked BUNKER never reads as the coin. */
export const tokenIdentity = (t: { tokenId: string; ticker: string | null }) =>
  t.ticker ? `${t.ticker} · ${t.tokenId}` : `token ${t.tokenId}`;

/** Freezes a pick; null when the token is not held right now. */
export function pickAsset(tokens: TokenBalance[], tokenId: string | null): SendAsset | null {
  if (tokenId === null) return NATIVE_SEND;
  const t = tokens.find((x) => x.tokenId === tokenId);
  if (!t) return null;
  return { kind: 'token', tokenId: t.tokenId, ticker: t.ticker, metadataHash: t.metadataHash, unit: tokenIdentity(t), scale: TOKEN_SCALE };
}

/** The live balance of the frozen asset; 'gone' once the token has left the wallet. */
export function heldOf(asset: SendAsset, balance: bigint | null, tokens: TokenBalance[]): bigint | null | 'gone' {
  if (asset.kind === 'native') return balance;
  return tokens.find((t) => t.tokenId === asset.tokenId)?.balance ?? 'gone';
}

const bunker = (units: bigint) => formatUnits(units, NATIVE_SCALE);

/** Why `units` of `asset` cannot be sent at `fee`, or ''. Pass `units` to re-check a reviewed amount. */
export function sendProblem(
  asset: SendAsset,
  units: bigint,
  fee: bigint,
  balance: bigint | null,
  tokens: TokenBalance[],
): string {
  const held = heldOf(asset, balance, tokens);
  if (held === 'gone') return TOKEN_GONE;
  if (held !== null && units > held) return 'Amount exceeds balance.';
  if (asset.kind === 'native' && balance !== null && units + fee > balance) return `Not enough BUNKER for the ${bunker(fee)} fee.`;
  if (asset.kind === 'token' && balance !== null && balance < fee) return `Token sends pay the fee in BUNKER. You hold ${bunker(balance)}.`;
  return '';
}

/** The amount step: parse with the asset's scale, then check it against live balances. */
export function amountProblem(
  asset: SendAsset,
  text: string,
  fee: bigint,
  balance: bigint | null,
  tokens: TokenBalance[],
): [string, bigint] {
  let value: bigint;
  try {
    value = parseAmount(text, asset.scale);
  } catch (e) {
    return [e instanceof AmountError ? e.message : 'Enter an amount above 0.', 0n];
  }
  return [sendProblem(asset, value, fee, balance, tokens), value];
}
