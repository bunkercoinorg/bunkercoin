import { withLock } from './locks.ts';

// Persisted because radio finality takes minutes: the tab closes before it lands.
const PREFIX = 'bunkercoin.pending.';
const VERSION = 'v2';
const LEGACY_KEY = `${PREFIX}v1`;
const MAX_ENTRIES = 20;

export type PendingKind = 'faucet' | 'send' | 'mint' | 'token-send' | 'metadata';

/**
 * 'uncertain': recorded before broadcast and not acknowledged by the node (yet).
 * 'unconfirmed': the confirmation window passed without an answer; polling continues slowly.
 */
export type PendingState = 'uncertain' | 'pending' | 'unconfirmed' | 'failed';

export interface PendingTx {
  txId: string;
  kind: PendingKind;
  amount: bigint;
  at: number;
  /** Null for transactions this wallet did not sign (faucet) or whose nonce is unknown (legacy). */
  nonce: bigint | null;
  state: PendingState;
  /** Base units; absent on faucet requests and pre-fee entries. */
  fee?: bigint;
  to?: string;
  ticker?: string;
  error?: string;
  /** A `failed` entry the chain executed and failed (fee and nonce spent), as opposed to a broadcast the node refused. */
  executed?: true;
}

/** A signed nonce that may still execute. Kept apart from Activity so dismissing or trimming never frees it. */
export interface Reservation {
  txId: string;
  nonce: bigint;
  at: number;
  /** The node never acknowledged the broadcast: its outcome is unknown and nothing new is signed until it settles. */
  uncertain: boolean;
  /** The exact broadcast payload, kept while uncertain so a rebroadcast resends the same transaction. */
  wire?: string;
}

const KINDS: PendingKind[] = ['faucet', 'send', 'mint', 'token-send', 'metadata'];
const STATES: PendingState[] = ['uncertain', 'pending', 'unconfirmed', 'failed'];
const DIGITS = /^\d+$/;

export function pendingKey(chain: string, address: string): string {
  return `${PREFIX}${VERSION}:${chain}:${address}`;
}

export function reservationKey(chain: string, address: string): string {
  return `${PREFIX}reservations:${chain}:${address}`;
}

function decode(v: unknown): PendingTx | null {
  if (typeof v !== 'object' || v === null) return null;
  const e = v as Record<string, unknown>;
  if (typeof e.txId !== 'string' || !KINDS.includes(e.kind as PendingKind) || !STATES.includes(e.state as PendingState)) return null;
  if (typeof e.amount !== 'string' || !DIGITS.test(e.amount) || typeof e.at !== 'number') return null;
  if (e.nonce !== null && (typeof e.nonce !== 'string' || !DIGITS.test(e.nonce))) return null;
  if (e.fee !== undefined && (typeof e.fee !== 'string' || !DIGITS.test(e.fee))) return null;
  return {
    txId: e.txId,
    kind: e.kind as PendingKind,
    amount: BigInt(e.amount),
    at: e.at,
    nonce: e.nonce === null ? null : BigInt(e.nonce as string),
    state: e.state as PendingState,
    ...(typeof e.fee === 'string' ? { fee: BigInt(e.fee) } : {}),
    ...(typeof e.to === 'string' ? { to: e.to } : {}),
    ...(typeof e.ticker === 'string' ? { ticker: e.ticker } : {}),
    ...(typeof e.error === 'string' ? { error: e.error } : {}),
    ...(e.executed === true ? { executed: true as const } : {}),
  };
}

const encode = (p: PendingTx) => ({
  ...p,
  amount: p.amount.toString(),
  nonce: p.nonce === null ? null : p.nonce.toString(),
  fee: p.fee === undefined ? undefined : p.fee.toString(),
});

function decodeReservation(v: unknown): Reservation | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.txId !== 'string' || typeof r.nonce !== 'string' || !DIGITS.test(r.nonce) || typeof r.at !== 'number') return null;
  return {
    txId: r.txId,
    nonce: BigInt(r.nonce),
    at: r.at,
    uncertain: r.uncertain === true,
    ...(typeof r.wire === 'string' ? { wire: r.wire } : {}),
  };
}

const encodeReservation = (r: Reservation) => ({ ...r, nonce: r.nonce.toString() });

function readList<T>(key: string, dec: (v: unknown) => T | null): T[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    if (!Array.isArray(list)) return [];
    return list.map(dec).filter((p): p is T => p !== null);
  } catch {
    return [];
  }
}

/** Read-modify-write under a cross-tab lock so tabs never drop each other's entries. Resolves false if not persisted. */
function mutateList<T>(key: string, dec: (v: unknown) => T | null, enc: (v: T) => unknown, op: (list: T[]) => T[]) {
  return withLock(key, () => {
    try {
      localStorage.setItem(key, JSON.stringify(op(readList(key, dec)).map(enc)));
      return true;
    } catch {
      return false;
    }
  });
}

export const loadPending = (chain: string, address: string): PendingTx[] => readList(pendingKey(chain, address), decode);

/** Over the cap the oldest failed entries go; open ones still need tracking and are never dropped. */
export function capEntries(list: PendingTx[]): PendingTx[] {
  const out = [...list];
  for (let i = out.length - 1; i >= 0 && out.length > MAX_ENTRIES; i--) {
    if (out[i].state === 'failed') out.splice(i, 1);
  }
  return out;
}

export const mutatePending = (
  chain: string,
  address: string,
  op: (list: PendingTx[]) => PendingTx[],
  capped = true,
): Promise<boolean> =>
  mutateList(pendingKey(chain, address), decode, encode, (list) => (capped ? capEntries(op(list)) : op(list)));

export const loadReservations = (chain: string, address: string): Reservation[] =>
  readList(reservationKey(chain, address), decodeReservation);

export const mutateReservations = (
  chain: string,
  address: string,
  op: (list: Reservation[]) => Reservation[],
): Promise<boolean> => mutateList(reservationKey(chain, address), decodeReservation, encodeReservation, op);

export const addEntry = (entry: PendingTx) => (list: PendingTx[]) => [entry, ...list.filter((p) => p.txId !== entry.txId)];

export const patchEntry = (txId: string, patch: Partial<PendingTx>) => (list: PendingTx[]) =>
  list.map((p) => (p.txId === txId ? { ...p, ...patch } : p));

/** Moves an entry on only from the state it was observed in, so a newer write is never undone. */
export const transitionEntry = (txId: string, from: PendingState, to: PendingState) => (list: PendingTx[]) =>
  list.map((p) => (p.txId === txId && p.state === from ? { ...p, state: to } : p));

export const removeEntry = (txId: string) => (list: PendingTx[]) => list.filter((p) => p.txId !== txId);

export const addReservation = (r: Reservation) => (list: Reservation[]) => [r, ...list.filter((x) => x.txId !== r.txId)];

export const patchReservation = (txId: string, patch: Partial<Reservation>) => (list: Reservation[]) =>
  list.map((r) => (r.txId === txId ? { ...r, ...patch } : r));

export const releaseReservations = (txIds: string[]) => (list: Reservation[]) => list.filter((r) => !txIds.includes(r.txId));

/** A signed v1 send whose nonce is not known yet; it may collide with a new one until it resolves. */
export const isUnresolvedLegacy = (p: PendingTx) => p.nonce === null && p.kind !== 'faucet' && p.state !== 'failed';

/** A pre-v2 entry: no chain, address or nonce; `failed` carried the error. */
export function fromLegacy(v: unknown): PendingTx | null {
  if (typeof v !== 'object' || v === null) return null;
  const e = v as Record<string, unknown>;
  if (typeof e.txId !== 'string' || !KINDS.includes(e.kind as PendingKind)) return null;
  const amount = typeof e.amount === 'number' && Number.isFinite(e.amount) && e.amount >= 0 ? BigInt(Math.round(e.amount)) : 0n;
  return {
    txId: e.txId,
    kind: e.kind as PendingKind,
    amount,
    at: typeof e.at === 'number' ? e.at : Date.now(),
    nonce: null,
    state: typeof e.failed === 'string' ? 'failed' : 'pending',
    ...(typeof e.to === 'string' ? { to: e.to } : {}),
    ...(typeof e.ticker === 'string' ? { ticker: e.ticker } : {}),
    ...(typeof e.failed === 'string' ? { error: e.failed } : {}),
  };
}

/**
 * The single-wallet v1 list moves to this wallet's chain+address key, uncapped; the trackers then reconcile each
 * entry against the node. The legacy key is removed only once every entry is read back under the new one.
 */
export function migrateLegacyPending(chain: string, address: string): Promise<number> {
  return withLock(LEGACY_KEY, async () => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(LEGACY_KEY);
    } catch {
      return 0;
    }
    if (raw === null) return 0;
    let list: unknown;
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
    const legacy = (Array.isArray(list) ? list : []).map(fromLegacy).filter((p): p is PendingTx => p !== null);
    const known = (current: PendingTx[]) => new Set(current.map((p) => p.txId));
    const saved = await mutatePending(
      chain,
      address,
      (current) => [...current, ...legacy.filter((p) => !known(current).has(p.txId))],
      false,
    );
    const stored = known(loadPending(chain, address));
    if (!saved || !legacy.every((p) => stored.has(p.txId))) return 0;
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Removed next time; the merge above is idempotent.
    }
    return legacy.length;
  });
}

/** Erasing the wallet removes tracking and reservations for every wallet and chain on this device, legacy included. */
export function clearAllPending(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage denied: nothing was persisted.
  }
}
