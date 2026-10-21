import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptMnemonic,
  decryptMnemonic,
  KDF_DEFAULTS,
  validateRecord,
  loadKeystore,
  saveKeystore,
  keystoreFingerprint,
  replaceKeystore,
  describeRecord,
  rememberAddress,
  rememberedAddress,
  clearKeystore,
  type KeystoreRecord,
} from '../src/lib/keystore.ts';
import { withLock } from '../src/lib/locks.ts';

// Fast parameters for functional tests — production strength is timed separately.
const FAST = { iterations: 1, memorySizeKiB: 1024, parallelism: 1 };

const PHRASE =
  'flash jazz better tiger arena mimic tumble ghost lens vault runway castle ' +
  'pilot lemon garden fossil pond insect trophy velvet spice ozone crystal rebel';

test('encrypt/decrypt round-trips the mnemonic', async () => {
  const record = await encryptMnemonic(PHRASE, 'correct horse battery staple', FAST);
  assert.equal(await decryptMnemonic(record, 'correct horse battery staple'), PHRASE);
});

test('wrong password is rejected, not garbage-decrypted', async () => {
  const record = await encryptMnemonic(PHRASE, 'right-password', FAST);
  await assert.rejects(decryptMnemonic(record, 'wrong-password'), /Incorrect password/);
});

test('ciphertext tampering is detected', async () => {
  const record = await encryptMnemonic(PHRASE, 'pw', FAST);
  const bytes = Uint8Array.from(atob(record.ciphertext), (c) => c.charCodeAt(0));
  bytes[0] ^= 0xff;
  const tampered = { ...record, ciphertext: btoa(String.fromCharCode(...bytes)) };
  await assert.rejects(decryptMnemonic(tampered, 'pw'), /Incorrect password/);
});

test('record never contains the phrase or password in plaintext', async () => {
  const record = await encryptMnemonic(PHRASE, 'hunter2-hunter2', FAST);
  const serialized = JSON.stringify(record);
  assert.ok(!serialized.includes('flash'), 'first mnemonic word leaked');
  assert.ok(!serialized.includes('hunter2'), 'password leaked');
});

test('two encryptions of the same phrase share nothing (fresh salt/iv)', async () => {
  const a = await encryptMnemonic(PHRASE, 'pw', FAST);
  const b = await encryptMnemonic(PHRASE, 'pw', FAST);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test('decryption honours the parameters stored in the record', async () => {
  const custom = { iterations: 2, memorySizeKiB: 2048, parallelism: 1 };
  const record = await encryptMnemonic(PHRASE, 'pw', custom);
  assert.equal(record.kdf.iterations, 2);
  assert.equal(await decryptMnemonic(record, 'pw'), PHRASE);
});

test('new records use production-strength KDF parameters', async () => {
  assert.deepEqual(KDF_DEFAULTS, { iterations: 14, memorySizeKiB: 256 * 1024, parallelism: 1 });
  const record = await encryptMnemonic(PHRASE, 'pw', FAST);
  assert.deepEqual(record.kdf, { name: 'argon2id', ...FAST }, 'params are stored with the record');
  const byDefault = await encryptMnemonic(PHRASE, 'pw');
  assert.deepEqual(byDefault.kdf, { name: 'argon2id', ...KDF_DEFAULTS }, 'new wallets get the production params');
});

// Written by the pre-worker keystore (main-thread hash-wasm); existing wallets must keep unlocking.
const LEGACY_RECORD = {
  version: 1,
  kdf: { name: 'argon2id', iterations: 2, memorySizeKiB: 1024, parallelism: 1 },
  salt: 'v8nlci6R5ywzFTVyyVVDwg==',
  iv: 'eMRGPgYHAOk969S9',
  ciphertext:
    'TywoHJ5nEs7rYALpZ8BHEfPiVRCsjIunGTnbx562Jxm7ALRIxph8jcH6sUQJRGEZ7WOBoVi/lCrqF2+OIK1S2qJaQF2rjAXd0Zf/I73wxcsl/ipe5gYvMBZddwtfmAPJ76mthVvUVrYOfW7Di7G5M80vbrGEEPZxSW5eII5l24KU9NNJxwUrhCnCA/gnHg45Bfoy6etcGMc+INMH3J6uPiG24cwMtqQ=',
} as KeystoreRecord;

test('a record written by the previous keystore code still decrypts', async () => {
  assert.equal(await decryptMnemonic(LEGACY_RECORD, 'legacy-password'), PHRASE);
});

test('records with unknown versions, kdfs or out-of-bounds params are refused', () => {
  const bad = (over: Record<string, unknown>, kdf: Record<string, unknown> = {}) => ({
    ...LEGACY_RECORD,
    ...over,
    kdf: { ...LEGACY_RECORD.kdf, ...kdf },
  });
  assert.throws(() => validateRecord(bad({ version: 2 })), /version/);
  assert.throws(() => validateRecord(bad({}, { name: 'pbkdf2' })), /kdf/);
  assert.throws(() => validateRecord(bad({}, { memorySizeKiB: 64 * 1024 * 1024 })), /memorySizeKiB/);
  assert.throws(() => validateRecord(bad({}, { iterations: 1e9 })), /iterations/);
  assert.throws(() => validateRecord(bad({}, { parallelism: 0 })), /parallelism/);
  assert.throws(() => validateRecord(bad({ iv: 'AAAA' })), /iv/);
  assert.throws(() => validateRecord(bad({ salt: '%%%' })), /salt/);
  assert.throws(() => validateRecord(null), /object/);
  assert.deepEqual(validateRecord(LEGACY_RECORD), LEGACY_RECORD);
});

async function withStorage(store: Map<string, string> | 'denied', fn: () => unknown) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const fake = {
    getItem: (k: string) => {
      if (store === 'denied') throw new Error('SecurityError');
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (store !== 'denied') store.set(k, v);
    },
    removeItem: (k: string) => {
      if (store !== 'denied') store.delete(k);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  try {
    await fn();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

test('absent, corrupt and denied storage are distinct states', async () => {
  await withStorage(new Map(), () => assert.equal(loadKeystore().status, 'absent'));
  await withStorage(new Map([['bunkercoin.keystore.v1', '{not json']]), () => assert.equal(loadKeystore().status, 'corrupt'));
  await withStorage(new Map([['bunkercoin.keystore.v1', JSON.stringify({ ...LEGACY_RECORD, version: 9 })]]), () =>
    assert.equal(loadKeystore().status, 'corrupt'),
  );
  await withStorage('denied', () => assert.equal(loadKeystore().status, 'unavailable'));
  await withStorage(new Map([['bunkercoin.keystore.v1', JSON.stringify(LEGACY_RECORD)]]), () =>
    assert.equal(loadKeystore().status, 'ok'),
  );
});

test('a corrupt record is never overwritten by a new wallet', async () => {
  const store = new Map([['bunkercoin.keystore.v1', '{not json']]);
  await withStorage(store, () => assert.rejects(saveKeystore(LEGACY_RECORD), /already exists/));
  assert.equal(store.get('bunkercoin.keystore.v1'), '{not json');
  const empty = new Map<string, string>();
  await withStorage(empty, () => saveKeystore(LEGACY_RECORD));
  assert.ok(empty.has('bunkercoin.keystore.v1'));
});

test('two simultaneous setups store exactly one wallet', async () => {
  const store = new Map<string, string>();
  const other = { ...LEGACY_RECORD, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
  await withStorage(store, async () => {
    const results = await Promise.allSettled([saveKeystore(LEGACY_RECORD), saveKeystore(other)]);
    assert.deepEqual(
      results.map((r) => r.status),
      ['fulfilled', 'rejected'],
    );
  });
  assert.equal(JSON.parse(store.get('bunkercoin.keystore.v1')!).salt, LEGACY_RECORD.salt);
});

test('the fingerprint changes with the salt or ciphertext', () => {
  const fp = keystoreFingerprint(LEGACY_RECORD);
  assert.match(fp, /^[0-9a-f]{64}$/);
  assert.equal(keystoreFingerprint({ ...LEGACY_RECORD }), fp);
  assert.notEqual(keystoreFingerprint({ ...LEGACY_RECORD, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }), fp);
  assert.notEqual(keystoreFingerprint({ ...LEGACY_RECORD, ciphertext: LEGACY_RECORD.ciphertext.replace(/^T/, 'U') }), fp);
});

test('a setup cancelled while waiting for the keystore lock saves nothing', async () => {
  const store = new Map<string, string>();
  await withStorage(store, async () => {
    let current = true;
    let release!: () => void;
    const acquired = new Promise<void>((ready) => {
      void withLock('bunkercoin.keystore.v1', () => {
        ready();
        return new Promise<void>((r) => (release = r));
      });
    });
    await acquired;
    const save = saveKeystore(LEGACY_RECORD, () => current);
    current = false;
    release();
    await assert.rejects(save, /cancelled/);
  });
  assert.equal(store.size, 0, 'an erased or abandoned setup must not recreate a wallet');
});

test('replacing overwrites only the record the user saw', async () => {
  const seen = '{not json';
  const store = new Map([['bunkercoin.keystore.v1', seen]]);
  await withStorage(store, async () => {
    await assert.rejects(replaceKeystore(LEGACY_RECORD, '{other'), /changed meanwhile/);
    assert.equal(store.get('bunkercoin.keystore.v1'), seen);
    await assert.rejects(replaceKeystore(LEGACY_RECORD, seen, () => false), /cancelled/);
    assert.equal(store.get('bunkercoin.keystore.v1'), seen);
    await replaceKeystore(LEGACY_RECORD, seen);
    assert.equal(loadKeystore().status, 'ok');
  });
});

test('describeRecord names the size and why it cannot be read', () => {
  assert.equal(describeRecord('{not json'), '9 bytes · not JSON');
  assert.match(describeRecord(JSON.stringify({ ...LEGACY_RECORD, version: 3 })), /^\d+ bytes · version 3, expected 1$/);
  assert.match(describeRecord(JSON.stringify({ ...LEGACY_RECORD, iv: 'AA==' })), /bytes · iv has the wrong length$/);
});

test('the remembered address belongs to one record and goes with an erase', async () => {
  const store = new Map([['bunkercoin.keystore.v1', JSON.stringify(LEGACY_RECORD)]]);
  await withStorage(store, async () => {
    rememberAddress('fp1', 'Addr1');
    assert.equal(rememberedAddress('fp1'), 'Addr1');
    assert.equal(rememberedAddress('fp2'), null);
    await clearKeystore();
    assert.equal(rememberedAddress('fp1'), null);
  });
});
