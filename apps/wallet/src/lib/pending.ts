// Persisted because radio finality takes minutes: the tab closes before it lands.
const PREFIX = 'bunkercoin.pending.';
const VERSION = 'v2';
const MAX_ENTRIES = 20;

export type PendingKind = 'faucet' | 'send' | 'mint' | 'token-send';

/** 'unconfirmed': the confirmation window passed without an answer; polling continues slowly. */
export type PendingState = 'pending' | 'unconfirmed' | 'failed';

export interface PendingTx {
  txId: string;
  kind: PendingKind;
  amount: bigint;
  at: number;
  /** Null for transactions this wallet did not sign (faucet). */
  nonce: bigint | null;
  state: PendingState;
  to?: string;
  ticker?: string;
  error?: string;
}

const KINDS: PendingKind[] = ['faucet', 'send', 'mint', 'token-send'];
const STATES: PendingState[] = ['pending', 'unconfirmed', 'failed'];

export function pendingKey(chain: string, address: string): string {
  return `${PREFIX}${VERSION}:${chain}:${address}`;
}

function decode(v: unknown): PendingTx | null {
  if (typeof v !== 'object' || v === null) return null;
  const e = v as Record<string, unknown>;
  if (typeof e.txId !== 'string' || !KINDS.includes(e.kind as PendingKind) || !STATES.includes(e.state as PendingState)) return null;
  if (typeof e.amount !== 'string' || !/^\d+$/.test(e.amount) || typeof e.at !== 'number') return null;
  if (e.nonce !== null && (typeof e.nonce !== 'string' || !/^\d+$/.test(e.nonce))) return null;
  return {
    txId: e.txId,
    kind: e.kind as PendingKind,
    amount: BigInt(e.amount),
    at: e.at,
    nonce: e.nonce === null ? null : BigInt(e.nonce as string),
    state: e.state as PendingState,
    ...(typeof e.to === 'string' ? { to: e.to } : {}),
    ...(typeof e.ticker === 'string' ? { ticker: e.ticker } : {}),
    ...(typeof e.error === 'string' ? { error: e.error } : {}),
  };
}

const encode = (p: PendingTx) => ({ ...p, amount: p.amount.toString(), nonce: p.nonce === null ? null : p.nonce.toString() });

export function loadPending(chain: string, address: string): PendingTx[] {
  try {
    const list = JSON.parse(localStorage.getItem(pendingKey(chain, address)) ?? '[]') as unknown;
    if (!Array.isArray(list)) return [];
    return list.map(decode).filter((p): p is PendingTx => p !== null);
  } catch {
    return [];
  }
}

/** Read-modify-write against storage so tabs do not drop each other's entries. Returns false if not persisted. */
export function mutatePending(chain: string, address: string, op: (list: PendingTx[]) => PendingTx[]): boolean {
  try {
    const next = op(loadPending(chain, address)).slice(0, MAX_ENTRIES);
    localStorage.setItem(pendingKey(chain, address), JSON.stringify(next.map(encode)));
    return true;
  } catch {
    return false;
  }
}

export const addEntry = (entry: PendingTx) => (list: PendingTx[]) => [entry, ...list.filter((p) => p.txId !== entry.txId)];

export const patchEntry = (txId: string, patch: Partial<PendingTx>) => (list: PendingTx[]) =>
  list.map((p) => (p.txId === txId ? { ...p, ...patch } : p));

export const removeEntry = (txId: string) => (list: PendingTx[]) => list.filter((p) => p.txId !== txId);

/** Erasing the wallet removes tracking for every wallet and chain on this device, legacy format included. */
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
