import { formatUnits, NATIVE_SCALE, shortId } from '@bunkercoin/chain-format';
import type { SignatureStatus, TokenBalance } from './connection.ts';
import { sameAddress } from './keys.ts';
import type { PendingPhase, PendingTx } from './pending.ts';

/** Signed or requested by this wallet and not settled yet: it may still move funds. */
export const isInflight = (p: PendingTx) => p.state === 'pending' || p.state === 'unconfirmed' || p.state === 'uncertain';

/**
 * Display phase from the node's answers. `processed` is never trusted: the node reports mempool entries that way at
 * the current slot, so only a transaction lookup places it in a block. Null keeps whatever was known before.
 */
export function phaseOf(status: SignatureStatus | null, location: string | null): PendingPhase | null {
  if (status !== null && status.err !== null) return null;
  if (location === 'confirmed' || location === 'finalized') return 'block';
  if (location === 'mempool') return 'mempool';
  return null;
}

export function phaseLabel(p: PendingTx): string {
  if (p.state === 'uncertain') return 'no answer from the node';
  if (p.phase === 'block') return 'in block · finalizing';
  if (p.phase === 'mempool') return 'in mempool · waiting for a block';
  return 'sent · waiting for a block';
}

export interface Spendable {
  /** Balance net of in-flight outgoing amounts and fees; null until the balance loaded. */
  available: bigint | null;
  pendingOut: bigint;
  /** Requested but not finalized (faucet); never spendable. */
  pendingIn: bigint;
}

const minus = (a: bigint, b: bigint) => (a > b ? a - b : 0n);

/** The chain balance only moves at finality, so everything in flight is subtracted (or held apart) here. */
export function nativeSpendable(balance: bigint | null, pending: PendingTx[]): Spendable {
  let out = 0n;
  let inc = 0n;
  for (const p of pending) {
    if (!isInflight(p)) continue;
    if (p.kind === 'faucet') inc += p.amount;
    else out += (p.kind === 'send' ? p.amount : 0n) + (p.fee ?? 0n);
  }
  return { available: balance === null ? null : minus(balance, out), pendingOut: out, pendingIn: inc };
}

/** tokenId -> in-flight outgoing amount. Entries from before token ids were recorded cannot be attributed. */
export function tokenPendingOut(pending: PendingTx[]): Map<string, bigint> {
  const m = new Map<string, bigint>();
  for (const p of pending) {
    if (p.kind === 'token-send' && p.tokenId && isInflight(p)) m.set(p.tokenId, (m.get(p.tokenId) ?? 0n) + p.amount);
  }
  return m;
}

/** Token balances as spendable right now; same tokens, same identity, smaller balances. */
export function spendableTokens(tokens: TokenBalance[], pending: PendingTx[]): TokenBalance[] {
  const out = tokenPendingOut(pending);
  return tokens.map((t) => (out.has(t.tokenId) ? { ...t, balance: minus(t.balance, out.get(t.tokenId)!) } : t));
}

export interface SendIntent {
  kind: 'send' | 'token-send';
  to: string;
  amount: bigint;
  tokenId?: string;
}

/** An in-flight send of the same asset and amount to the same recipient: likely a double tap, so ask first. */
export function findDuplicate(pending: PendingTx[], intent: SendIntent): PendingTx | null {
  return (
    pending.find(
      (p) =>
        isInflight(p) &&
        p.kind === intent.kind &&
        p.amount === intent.amount &&
        p.to !== undefined &&
        sameAddress(p.to, intent.to) &&
        (intent.kind === 'send' || p.tokenId === intent.tokenId),
    ) ?? null
  );
}

/** `<1 min`, `3 min`, `2 h`. */
export function coarseAgo(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return 'under a minute';
  if (m < 90) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}

export const duplicatePrompt = (what: string, to: string, at: number, now: number) =>
  `You already sent ${what} to ${shortId(to)} ${coarseAgo(now - at)} ago. Send again?`;

/** Gaps between distinct finalization instants, newest first. */
export function blockIntervals(times: number[]): number[] {
  const t = [...new Set(times)].sort((a, b) => b - a);
  const out: number[] = [];
  for (let i = 1; i < t.length; i++) out.push(t[i - 1] - t[i]);
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const MIN_INTERVALS = 3;

function coarseMinutes(ms: number, up: boolean): number {
  const min = ms / 60_000;
  const step = min < 10 ? 1 : min < 60 ? 5 : 30;
  const v = (up ? Math.ceil(min / step) : Math.floor(min / step)) * step;
  return Math.max(1, v);
}

const span = (min: number) => (min >= 90 ? `${Math.round(min / 30) / 2} h` : `${min} min`);

/**
 * `usually 5-30 min`: one to three observed block intervals (median), since a transaction often waits for 1-3
 * finalized blocks. Null until a few intervals were seen; never a countdown.
 */
export function cadenceHint(intervals: number[]): string | null {
  if (intervals.length < MIN_INTERVALS) return null;
  const m = median(intervals);
  const lo = coarseMinutes(m, false);
  const hi = Math.max(lo, coarseMinutes(3 * m, true));
  if (lo === hi) return `usually ~${span(lo)}`;
  if (hi < 90) return `usually ${lo}-${hi} min`;
  return `usually ${span(lo)}-${span(hi)}`;
}

export const titleWithCount = (base: string, n: number) => (n > 0 ? `(${n}) ${base}` : base);

const bunker = (u: bigint) => `${formatUnits(u, NATIVE_SCALE)} BUNKER`;

/** One line for the lock screen; null when nothing is in flight. */
export function inflightSummary(pending: PendingTx[]): string | null {
  const open = pending.filter(isInflight);
  if (open.length === 0) return null;
  const { pendingOut, pendingIn } = nativeSpendable(null, open);
  const parts = [`${open.length} ${open.length === 1 ? 'transfer' : 'transfers'} in flight`];
  if (pendingOut > 0n) parts.push(`${bunker(pendingOut)} out`);
  if (pendingIn > 0n) parts.push(`${bunker(pendingIn)} in`);
  return `${parts.join(' · ')}. Tracking continues while locked.`;
}

export function describe(p: PendingTx): string {
  const to = p.to ? ` to ${shortId(p.to)}` : '';
  switch (p.kind) {
    case 'faucet':
      return `faucet ${bunker(p.amount)}`;
    case 'mint':
      return `token ${p.ticker ?? ''}`.trim();
    case 'metadata':
      return `${p.ticker ?? 'token'} details`;
    case 'token-send':
      return `${formatUnits(p.amount, 0)} ${p.ticker ?? ''}${to}`;
    default:
      return `${bunker(p.amount)}${to}`;
  }
}

export const settledText = (p: PendingTx, error: string | null) =>
  error === null ? `Finalized: ${describe(p)}.` : `Failed: ${describe(p)}. ${error}`;
