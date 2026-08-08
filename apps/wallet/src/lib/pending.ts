// Persisted because radio finality takes minutes — the tab closes before it lands.
const STORAGE_KEY = 'bunkercoin.pending.v1';

export interface PendingTx {
  txId: string;
  kind: 'faucet' | 'send' | 'mint' | 'token-send';
  amount: number;
  at: number;
  to?: string;
  ticker?: string;
  failed?: string;
}

export function loadPending(): PendingTx[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as PendingTx[]) ?? [];
  } catch {
    return [];
  }
}

export function savePending(list: PendingTx[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addPending(entry: PendingTx): PendingTx[] {
  const list = loadPending();
  list.unshift(entry);
  savePending(list.slice(0, 20));
  return list;
}

export function removePending(txId: string): PendingTx[] {
  const list = loadPending().filter((p) => p.txId !== txId);
  savePending(list);
  return list;
}
