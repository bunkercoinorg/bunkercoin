import { argon2Raw, type KdfParams, type KdfResponse } from './kdf.ts';

export type { KdfParams } from './kdf.ts';

const STORAGE_KEY = 'bunkercoin.keystore.v1';

export interface KeystoreRecord {
  version: 1;
  kdf: KdfParams & { name: 'argon2id' };
  salt: string;
  iv: string;
  ciphertext: string;
}

export type KeystoreState =
  | { status: 'absent' }
  | { status: 'ok'; record: KeystoreRecord }
  | { status: 'corrupt'; reason: string }
  | { status: 'unavailable'; reason: string };

// ~2-3s per guess by design; params live in each record so defaults can change safely.
export const KDF_DEFAULTS: KdfParams = {
  iterations: 14,
  memorySizeKiB: 256 * 1024,
  parallelism: 1,
};

// A tampered record must not be able to hang or OOM every unlock.
export const KDF_BOUNDS: Record<keyof KdfParams, [number, number]> = {
  iterations: [1, 64],
  memorySizeKiB: [1024, 1024 * 1024],
  parallelism: [1, 16],
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromB64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

function deriveRaw(password: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') return argon2Raw(password, salt, params);
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      // Classic worker: the bundler loads its chunks with importScripts.
      worker = new Worker(new URL('./kdf.worker.ts', import.meta.url));
    } catch {
      argon2Raw(password, salt, params).then(resolve, reject);
      return;
    }
    worker.onmessage = ({ data }: MessageEvent<KdfResponse>) => {
      worker.terminate();
      if (data.ok) resolve(data.raw);
      else reject(new Error(data.message));
    };
    // A worker that cannot load must not lock the user out; derive on the main thread instead.
    worker.onerror = (e) => {
      e.preventDefault();
      worker.terminate();
      argon2Raw(password, salt, params).then(resolve, reject);
    };
    worker.postMessage({ password, salt, params });
  });
}

async function deriveKey(password: string, salt: Uint8Array, params: KdfParams): Promise<CryptoKey> {
  const raw = await deriveRaw(password, salt, params);
  try {
    return await crypto.subtle.importKey('raw', raw as Uint8Array<ArrayBuffer>, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  } finally {
    raw.fill(0);
  }
}

function decodeField(record: Record<string, unknown>, field: string, min: number, max: number): Uint8Array<ArrayBuffer> {
  const value = record[field];
  if (typeof value !== 'string') throw new Error(`missing ${field}`);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromB64(value);
  } catch {
    throw new Error(`${field} is not base64`);
  }
  if (bytes.length < min || bytes.length > max) throw new Error(`${field} has the wrong length`);
  return bytes;
}

/** Throws a descriptive error for anything but a well-formed v1 Argon2id record. */
export function validateRecord(value: unknown): KeystoreRecord {
  if (typeof value !== 'object' || value === null) throw new Error('record is not an object');
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw new Error(`unsupported version ${String(record.version)}`);
  const kdf = record.kdf as Record<string, unknown> | null;
  if (typeof kdf !== 'object' || kdf === null) throw new Error('missing kdf');
  if (kdf.name !== 'argon2id') throw new Error(`unsupported kdf ${String(kdf.name)}`);
  const params = {} as KdfParams;
  for (const key of Object.keys(KDF_BOUNDS) as (keyof KdfParams)[]) {
    const [min, max] = KDF_BOUNDS[key];
    const n = kdf[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new Error(`kdf ${key} out of bounds`);
    params[key] = n;
  }
  decodeField(record, 'salt', 16, 64);
  decodeField(record, 'iv', 12, 12);
  decodeField(record, 'ciphertext', 17, 4096);
  return {
    version: 1,
    kdf: { name: 'argon2id', ...params },
    salt: record.salt as string,
    iv: record.iv as string,
    ciphertext: record.ciphertext as string,
  };
}

/** Encrypts the mnemonic under the password. Plaintext never leaves memory. */
export async function encryptMnemonic(
  mnemonic: string,
  password: string,
  params: KdfParams = KDF_DEFAULTS,
): Promise<KeystoreRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, params);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic)));
  return validateRecord({
    version: 1,
    kdf: { name: 'argon2id', ...params },
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  });
}

export async function decryptMnemonic(record: KeystoreRecord, password: string): Promise<string> {
  const valid = validateRecord(record);
  const key = await deriveKey(password, fromB64(valid.salt), valid.kdf);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(valid.iv) }, key, fromB64(valid.ciphertext));
    return dec.decode(plaintext);
  } catch {
    // AES-GCM auth failure is indistinguishable from a wrong password.
    throw new Error('Incorrect password');
  }
}

export function loadKeystore(): KeystoreState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return { status: 'unavailable', reason: (e as Error).message || 'storage is blocked' };
  }
  if (raw === null) return { status: 'absent' };
  try {
    return { status: 'ok', record: validateRecord(JSON.parse(raw)) };
  } catch (e) {
    return { status: 'corrupt', reason: (e as Error).message };
  }
}

/** The record to decrypt, or a user-facing error for every other storage state. */
export function requireKeystore(): KeystoreRecord {
  const state = loadKeystore();
  if (state.status === 'ok') return state.record;
  if (state.status === 'absent') throw new Error('No wallet on this device');
  if (state.status === 'corrupt') throw new Error(`The stored wallet is unreadable (${state.reason})`);
  throw new Error(`Browser storage is unavailable (${state.reason})`);
}

/** Refuses to overwrite anything already stored, including a record that failed to parse. */
export function saveKeystore(record: KeystoreRecord): void {
  const existing = loadKeystore();
  if (existing.status !== 'absent') throw new Error('A wallet record already exists on this device');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validateRecord(record)));
}

export function clearKeystore(): void {
  localStorage.removeItem(STORAGE_KEY);
}
