import { argon2id } from 'hash-wasm';

const STORAGE_KEY = 'bunkercoin.keystore.v1';

// Tuned so derivation costs 2-3s on desktop hardware: brute-forcing a stolen
// keystore has to pay this per guess. Parameters are stored per-record so
// existing wallets keep working if these defaults change.
export const KDF_DEFAULTS = {
  iterations: 14,
  memorySizeKiB: 256 * 1024,
  parallelism: 1,
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function deriveKey(password, salt, params) {
  const raw = await argon2id({
    password,
    salt,
    iterations: params.iterations,
    memorySize: params.memorySizeKiB,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: 'binary',
  });
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Encrypts the mnemonic under the password. Plaintext never leaves memory. */
export async function encryptMnemonic(mnemonic, password, params = KDF_DEFAULTS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, params);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic)),
  );
  return {
    version: 1,
    kdf: { name: 'argon2id', ...params },
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  };
}

export async function decryptMnemonic(record, password) {
  const params = {
    iterations: record.kdf.iterations,
    memorySizeKiB: record.kdf.memorySizeKiB,
    parallelism: record.kdf.parallelism,
  };
  const key = await deriveKey(password, fromB64(record.salt), params);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(record.iv) },
      key,
      fromB64(record.ciphertext),
    );
    return dec.decode(plaintext);
  } catch {
    // AES-GCM auth failure is indistinguishable from a wrong password.
    throw new Error('Incorrect password');
  }
}

export function loadKeystore() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveKeystore(record) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function clearKeystore() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasKeystore() {
  return loadKeystore() !== null;
}
