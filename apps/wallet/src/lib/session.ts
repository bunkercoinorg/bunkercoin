import { ed25519 } from '@noble/curves/ed25519.js';
import bs58 from 'bs58';
import type { Keypair } from './keys.ts';
import type { Signer } from './signer.ts';

// The private key is encrypted under a non-extractable AES key (IndexedDB holds the CryptoKey,
// sessionStorage the ciphertext); each tab session has its own wrapping key.
const DB_NAME = 'bunkercoin-session';
const STORE = 'keys';
const STORAGE_KEY = 'bunkercoin.session.v2';
const LEGACY_KEYS = ['bunkercoin.session.v1'];
const LEGACY_WRAP_ID = 'wrap-key';
const ORPHAN_AFTER_MS = 24 * 60 * 60_000;
export const SESSION_IDLE_MS = 15 * 60_000;

export const AUTO_LOCK_OPTIONS = [1, 5, 15, 60] as const;
export type AutoLockMinutes = (typeof AUTO_LOCK_OPTIONS)[number];
const AUTO_LOCK_KEY = 'bunkercoin.autolock.v1';
const DEFAULT_AUTO_LOCK: AutoLockMinutes = 15;

export const isAutoLockMinutes = (v: unknown): v is AutoLockMinutes => AUTO_LOCK_OPTIONS.includes(v as AutoLockMinutes);

/** The chosen idle timeout; 15 min when unset, unreadable or not one of the options. */
export function loadAutoLockMinutes(): AutoLockMinutes {
  try {
    const v = Number(localStorage.getItem(AUTO_LOCK_KEY));
    return isAutoLockMinutes(v) ? v : DEFAULT_AUTO_LOCK;
  } catch {
    return DEFAULT_AUTO_LOCK;
  }
}

export function saveAutoLockMinutes(minutes: AutoLockMinutes): void {
  if (!isAutoLockMinutes(minutes)) throw new RangeError('unsupported auto-lock');
  try {
    localStorage.setItem(AUTO_LOCK_KEY, String(minutes));
  } catch {
    // Storage denied: the choice lasts for this page only.
  }
}

export const autoLockMs = (minutes: AutoLockMinutes = loadAutoLockMinutes()) => minutes * 60_000;

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

interface SessionBlob {
  id: string;
  iv: string;
  ct: string;
  at: number;
  /** keystoreFingerprint of the record this key was unlocked from. */
  fp: string;
}

interface WrapEntry {
  key: CryptoKey;
  created: number;
}

export interface RestoredSession {
  keypair: Keypair;
  /** Last persisted user activity; the idle deadline counts from here. */
  lastActivity: number;
}

const wrapId = (id: string) => `wrap-${id}`;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Runs one request and resolves only once its transaction has committed. */
async function idb<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function readBlob(): SessionBlob | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as Partial<SessionBlob>;
    if (typeof blob.id !== 'string' || typeof blob.iv !== 'string' || typeof blob.ct !== 'string') return null;
    if (typeof blob.at !== 'number' || !Number.isFinite(blob.at)) return null;
    return { ...(blob as SessionBlob), fp: typeof blob.fp === 'string' ? blob.fp : '' };
  } catch {
    return null;
  }
}

function dropBlob(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    LEGACY_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Storage denied: there is nothing to remove either.
  }
}

// Every revoke bumps the generation; saves and loads started before it give up.
let generation = 0;
let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function sweepOrphans(keep: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        const entry = c.value as Partial<WrapEntry> | undefined;
        if (c.key !== keep && (!entry?.created || Date.now() - entry.created > ORPHAN_AFTER_MS)) c.delete();
        c.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Best-effort: without a session the user simply unlocks again after a reload. */
export function saveSession(signer: Signer, fingerprint: string): Promise<void> {
  const gen = generation;
  const stale = () => gen !== generation || !signer.active;
  return serialized(async () => {
    if (stale()) return;
    const previous = readBlob();
    const id = toB64(crypto.getRandomValues(new Uint8Array(12))).replace(/[+/=]/g, '');
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    // WebCrypto copies the input synchronously, so the key buffer is not read after `use` returns.
    const sealing = signer.use((privateKey) =>
      crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, privateKey as Uint8Array<ArrayBuffer>),
    );
    const ct = new Uint8Array(await sealing);
    if (stale()) return;
    await idb('readwrite', (s) => s.put({ key, created: Date.now() } satisfies WrapEntry, wrapId(id)));
    if (stale()) {
      await idb('readwrite', (s) => s.delete(wrapId(id)));
      return;
    }
    const blob: SessionBlob = { id, iv: toB64(iv), ct: toB64(ct), at: Date.now(), fp: fingerprint };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    if (previous && previous.id !== id) await idb('readwrite', (s) => s.delete(wrapId(previous.id)));
    await sweepOrphans(wrapId(id)).catch(() => undefined);
  }).catch(() => undefined);
}

/** Restores only a session unlocked from the keystore record with this fingerprint; any other is revoked. */
export async function loadSession(fingerprint: string): Promise<RestoredSession | null> {
  const gen = generation;
  const blob = readBlob();
  if (!blob) return null;
  if (blob.fp !== fingerprint || Date.now() - blob.at > autoLockMs()) {
    await revokeSession();
    return null;
  }
  try {
    const entry = await idb<WrapEntry | undefined>('readonly', (s) => s.get(wrapId(blob.id)));
    if (!entry?.key) return null;
    const privateKey = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, entry.key, fromB64(blob.ct)),
    );
    if (gen !== generation || privateKey.length !== 32) {
      privateKey.fill(0);
      return null;
    }
    const publicKey = ed25519.getPublicKey(privateKey);
    return { keypair: { privateKey, publicKey, address: bs58.encode(publicKey) }, lastActivity: blob.at };
  } catch {
    await revokeSession();
    return null;
  }
}

let lastTouch = 0;

/** Persist user activity (throttled) so a reload resumes with the remaining idle time only. */
export function touchSession(now = Date.now()): void {
  if (now - lastTouch < 10_000) return;
  lastTouch = now;
  const blob = readBlob();
  if (!blob) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...blob, at: now }));
  } catch {
    // Worst case the session expires early.
  }
}

/** v1 kept its ciphertext in sessionStorage and one shared wrapping key in IndexedDB; both go, expired or not. */
export async function removeLegacySession(): Promise<void> {
  try {
    LEGACY_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Storage denied: nothing to remove.
  }
  await idb('readwrite', (s) => s.delete(LEGACY_WRAP_ID)).catch(() => undefined);
}

/** Resolves once the ciphertext and its wrapping key are both gone. */
export function revokeSession(): Promise<void> {
  generation++;
  lastTouch = 0;
  const id = readBlob()?.id;
  dropBlob();
  return serialized(async () => {
    const ids = new Set([id, readBlob()?.id].filter((x): x is string => !!x));
    dropBlob();
    for (const i of ids) await idb('readwrite', (s) => s.delete(wrapId(i)));
  }).catch(() => undefined);
}
