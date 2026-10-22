// IndexedDB first, localStorage as a fallback; every failure reads as "nothing stored".
const DB = 'bunkercoin-explorer';
const STORE = 'archive';
const LS_PREFIX = 'bunkercoin.explorer.archive:';

export const archiveKey = (apiUrl: string) => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl;
  }
};

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(STORE, mode);
          const req = run(tx.objectStore(STORE));
          tx.oncomplete = () => {
            db.close();
            resolve(req.result);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve(undefined);
          };
        } catch {
          db.close();
          resolve(undefined);
        }
      }),
  );
}

export async function loadArchive(key: string): Promise<string | null> {
  const fromDb = await idb<unknown>('readonly', (s) => s.get(key));
  if (typeof fromDb === 'string') return fromDb;
  try {
    return localStorage.getItem(LS_PREFIX + key);
  } catch {
    return null;
  }
}

export async function saveArchive(key: string, text: string): Promise<void> {
  const ok = await idb('readwrite', (s) => s.put(text, key));
  if (ok !== undefined) return;
  try {
    localStorage.setItem(LS_PREFIX + key, text);
  } catch {
    // quota or blocked storage: the page works without it
  }
}
