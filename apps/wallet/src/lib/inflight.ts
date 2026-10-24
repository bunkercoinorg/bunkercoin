import { formatUnits, NATIVE_SCALE, shortId } from '@bunkercoin/chain-format';
import type { SignatureStatus, TokenBalance } from './connection.ts';
import { sameAddress } from './keys.ts';
import type { PendingPhase, PendingTx } from './pending.ts';
import type { Submission } from './submit.ts';

/** Signed or requested by this wallet and not settled yet: it may still move funds. */
export const isInflight = (p: PendingTx) =>
  p.finalizedAt === undefined && (p.state === 'pending' || p.state === 'unconfirmed' || p.state === 'uncertain');

/** In flight, or finalized but not yet reflected in a committed balance: either way its funds are spoken for. */
export const holdsFunds = (p: PendingTx) => isInflight(p) || (p.finalizedAt !== undefined && p.state !== 'failed');

/** A balance whose fetch began at `at` already includes this entry's effect. */
export const reflectedIn = (p: PendingTx, at: number) => p.finalizedAt !== undefined && p.finalizedAt < at;

/** Drops what a committed balance fetched at `at` already reflects; apply in the same update as that balance. */
export const dropReflected = (at: number) => (list: PendingTx[]) => list.filter((p) => !reflectedIn(p, at));

export interface Snapshot<T> {
  value: T;
  /** When the fetch began. */
  at: number;
}

export interface SnapshotDeps<T> {
  fetch: () => Promise<T>;
  /** The tab's entries as they are now. */
  entries: () => PendingTx[];
  statuses: (txIds: string[]) => Promise<(SignatureStatus | null)[]>;
  /** Records them as finalized at `at`, which is after the fetch that may or may not include them. */
  finalize: (txIds: string[], at: number) => unknown;
  now?: () => number;
  tries?: number;
}

/**
 * Balances read as one snapshot against settlement. An entry that finalized while the fetch ran, seen by a tracker or
 * by the status check here, may or may not be in it, so the fetch is repeated; null when every try spanned one.
 */
export async function fetchSnapshot<T>({ fetch, entries, statuses, finalize, now = Date.now, tries = 3 }: SnapshotDeps<T>): Promise<Snapshot<T> | null> {
  const settled = new Set<string>();
  for (let i = 0; i < tries; i++) {
    const at = now();
    const value = await fetch();
    const list = entries();
    if (list.some((p) => p.finalizedAt !== undefined && p.finalizedAt >= at)) continue;
    const ids = list.filter((p) => isInflight(p) && !settled.has(p.txId)).map((p) => p.txId);
    if (ids.length === 0) return { value, at };
    const st = await statuses(ids);
    const done = ids.filter((_, j) => st[j]?.confirmationStatus === 'finalized' && st[j]!.err === null);
    if (done.length === 0) return { value, at };
    done.forEach((id) => settled.add(id));
    finalize(done, now());
  }
  return null;
}

/**
 * This tab's list rebuilt from storage after another tab (or this one) wrote it. Stored entries win, keeping a
 * finalization this tab saw first. One this tab had persisted that left storage still holds its funds here until this
 * tab commits a balance fetched after it went; entries never persisted yet are a write in progress and stay as they are.
 */
export function mergeStored(stored: PendingTx[], local: PendingTx[], persisted: ReadonlySet<string>, reconciledAt: number, now: number): PendingTx[] {
  const byId = new Map(local.map((p) => [p.txId, p]));
  const ids = new Set(stored.map((p) => p.txId));
  const out = stored.map((s) => {
    const l = byId.get(s.txId);
    return s.finalizedAt === undefined && l?.finalizedAt !== undefined ? { ...s, finalizedAt: l.finalizedAt } : s;
  });
  for (const l of local) {
    if (ids.has(l.txId)) continue;
    if (!persisted.has(l.txId)) out.push(l);
    else if (holdsFunds(l)) {
      const held = l.finalizedAt === undefined ? { ...l, finalizedAt: now } : l;
      if (!reflectedIn(held, reconciledAt)) out.push(held);
    }
  }
  return out;
}

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
  return `${p.kind === 'faucet' ? 'requested' : 'sent'} · waiting for a block`;
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
    if (!holdsFunds(p)) continue;
    if (p.kind === 'faucet') inc += p.amount;
    else out += (p.kind === 'send' ? p.amount : 0n) + (p.fee ?? 0n);
  }
  return { available: balance === null ? null : minus(balance, out), pendingOut: out, pendingIn: inc };
}

/** tokenId -> in-flight outgoing amount. Entries from before token ids were recorded cannot be attributed. */
export function tokenPendingOut(pending: PendingTx[]): Map<string, bigint> {
  const m = new Map<string, bigint>();
  for (const p of pending) {
    if (p.kind === 'token-send' && p.tokenId && holdsFunds(p)) m.set(p.tokenId, (m.get(p.tokenId) ?? 0n) + p.amount);
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

const intentOf = (info: Submission): SendIntent | null =>
  (info.kind === 'send' || info.kind === 'token-send') && info.to !== undefined
    ? { kind: info.kind, to: info.to, amount: info.amount, ...(info.tokenId ? { tokenId: info.tokenId } : {}) }
    : null;

/**
 * Re-checked under the submission lock against durable entries, right before signing: another tab may have spent the
 * funds or sent the same thing since review. `duplicateOk` is the in-flight tx the user approved sending again; '' if fine.
 */
export function revalidate(info: Submission, balance: bigint | null, tokens: TokenBalance[], entries: PendingTx[], duplicateOk: string | null): string {
  const native = nativeSpendable(balance, entries).available;
  const fee = info.fee ?? 0n;
  const spent = 'Another transfer spent these funds since review. Review again.';
  if (native !== null && (info.kind === 'send' ? info.amount : 0n) + fee > native) return spent;
  if (info.kind === 'token-send' && info.tokenId) {
    const t = spendableTokens(tokens, entries).find((x) => x.tokenId === info.tokenId);
    if (t && info.amount > t.balance) return spent;
  }
  const intent = intentOf(info);
  const dup = intent && findDuplicate(entries, intent);
  if (dup && dup.txId !== duplicateOk) return `A matching send (${shortId(dup.txId)}) started since review. Review again.`;
  return '';
}

/** Approval to send a duplicate again is bound to the exact intent reviewed and the in-flight tx it matched. */
export const approvalKey = (intent: SendIntent, dupTxId: string) =>
  [intent.kind, intent.tokenId ?? '', intent.amount.toString(), intent.to, dupTxId].join('|');

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
