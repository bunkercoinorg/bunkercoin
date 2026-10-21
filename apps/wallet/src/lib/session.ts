import { ed25519 } from '@noble/curves/ed25519.js';
import bs58 from 'bs58';
import type { Keypair } from './keys';

// The private key is encrypted under a non-extractable AES key (IndexedDB
// holds the CryptoKey, sessionStorage the ciphertext) — per-tab, never readable in storage.
const DB_NAME = 'bunkercoin-session';
const STORE = 'keys';
const KEY_ID = 'wrap-key';
const STORAGE_KEY = 'bunkercoin.session.v1';
export const SESSION_IDLE_MS = 15 * 60_000;

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface SessionBlob {
  iv: string;
  ct: string;
  at: number;
}

export async function saveSession(keypair: Keypair): Promise<void> {
  try {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, keypair.privateKey as Uint8Array<ArrayBuffer>),
    );
    const db = await openDb();
    await idbRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).put(key, KEY_ID));
    db.close();
    const blob: SessionBlob = { iv: toB64(iv), ct: toB64(ct), at: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Best-effort: without a session the user simply unlocks again.
  }
}

export async function loadSession(): Promise<Keypair | null> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as SessionBlob;
    if (Date.now() - blob.at > SESSION_IDLE_MS) {
      clearSession();
      return null;
    }
    const db = await openDb();
    const key = await idbRequest<CryptoKey | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY_ID),
    );
    db.close();
    if (!key) return null;
    const privateKey = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromB64(blob.iv) as Uint8Array<ArrayBuffer> },
        key,
        fromB64(blob.ct) as Uint8Array<ArrayBuffer>,
      ),
    );
    const publicKey = ed25519.getPublicKey(privateKey);
    return { privateKey, publicKey, address: bs58.encode(publicKey) };
  } catch {
    return null;
  }
}

let lastTouch = 0;

/** Slide the idle window forward on user activity (throttled). */
export function touchSession(): void {
  const now = Date.now();
  if (now - lastTouch < 10_000) return;
  lastTouch = now;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const blob = JSON.parse(raw) as SessionBlob;
    blob.at = now;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    // Ignore — worst case the session expires on schedule.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    // Removing the wrap key makes any leftover ciphertext undecryptable.
    void openDb().then((db) => {
      db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY_ID);
      db.close();
    });
  } catch {
    // Blob without key (or vice versa) is useless anyway.
  }
}
