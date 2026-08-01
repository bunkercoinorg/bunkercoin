// Pending transactions survive reloads: radio finality takes minutes, and the
// user will close the tab before it lands.
const STORAGE_KEY = 'bunkercoin.pending.v1';

export function loadPending() {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function savePending(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addPending(entry) {
  const list = loadPending();
  list.unshift(entry);
  savePending(list.slice(0, 20));
  return list;
}

export function removePending(txId) {
  const list = loadPending().filter((p) => p.txId !== txId);
  savePending(list);
  return list;
}
