import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bs58 from 'bs58';
import {
  broadcast,
  BroadcastUncertainError,
  isDefiniteRejection,
  planNonce,
  reconcileNonce,
  withAccountLock,
} from '../src/lib/submit.ts';
import { Signer, WalletLockedError } from '../src/lib/signer.ts';
import {
  addEntry,
  addReservation,
  clearAllPending,
  fromLegacy,
  loadPending,
  loadReservations,
  migrateLegacyPending,
  mutatePending,
  mutateReservations,
  patchEntry,
  removeEntry,
  type PendingTx,
} from '../src/lib/pending.ts';
import { RpcError, type SignatureStatus } from '../src/lib/connection.ts';
import { keypairFromMnemonic, createMnemonic, signTransfer, transactionId } from '../src/lib/keys.ts';

test('nonce advances past live outstanding transactions only', () => {
  assert.equal(reconcileNonce(5n, []), 5n);
  assert.equal(reconcileNonce(5n, [{ nonce: 5n, live: true }, { nonce: 6n, live: true }]), 7n);
  assert.equal(reconcileNonce(5n, [{ nonce: 5n, live: false }, { nonce: 6n, live: true }]), 5n, 'a dropped tx frees its nonce');
  assert.equal(reconcileNonce(5n, [{ nonce: 4n, live: true }]), 5n, 'executed nonces are ignored');
  assert.equal(reconcileNonce(5n, [{ nonce: 7n, live: true }]), 5n, 'gaps are filled first');
});

test('submissions on one account never overlap', async () => {
  const order: string[] = [];
  const job = (name: string, ms: number) =>
    withAccountLock('acct', async () => {
      order.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${name}:end`);
      if (name === 'b') throw new Error('boom');
    });
  const results = await Promise.allSettled([job('a', 20), job('b', 1), job('c', 1)]);
  assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  assert.equal(results[1].status, 'rejected', 'a failure is reported to its caller only');
  assert.equal(results[2].status, 'fulfilled');
});

test('a revoked signer zeroes its key and refuses to sign', () => {
  const keypair = keypairFromMnemonic(createMnemonic());
  const key = keypair.privateKey;
  const signer = new Signer(keypair);
  assert.equal(signer.use((pk) => pk.length), 32);
  signer.revoke();
  assert.ok(key.every((b) => b === 0), 'key buffer must be wiped');
  assert.equal(signer.active, false);
  assert.throws(() => signer.assertActive(), WalletLockedError);
  assert.throws(() => signer.use(() => 1), WalletLockedError);
});

function fakeStorage() {
  const store = new Map<string, string>();
  const fake = {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  return store;
}

const entry = (over: Partial<PendingTx> = {}): PendingTx => ({
  txId: 'tx1',
  kind: 'send',
  amount: 9007199254740993n,
  at: 1,
  nonce: 3n,
  state: 'pending',
  ...over,
});

test('pending entries are scoped by chain and address and keep bigint amounts', async () => {
  const store = fakeStorage();
  assert.ok(await mutatePending('rpc-a', 'alice', addEntry(entry())));
  assert.deepEqual(loadPending('rpc-a', 'alice'), [entry()]);
  assert.deepEqual(loadPending('rpc-a', 'bob'), [], 'another wallet must not inherit activity');
  assert.deepEqual(loadPending('rpc-b', 'alice'), [], 'another chain must not inherit activity');
  await mutatePending('rpc-a', 'alice', patchEntry('tx1', { state: 'unconfirmed' }));
  assert.equal(loadPending('rpc-a', 'alice')[0].state, 'unconfirmed');
  store.set('bunkercoin.pending.v1', '[]');
  clearAllPending();
  assert.equal(store.size, 0, 'erase clears every wallet, chain and legacy entry');
});

test('malformed pending entries are dropped, not trusted', async () => {
  const store = fakeStorage();
  await mutatePending('c', 'a', addEntry(entry()));
  const key = [...store.keys()][0];
  const list = JSON.parse(store.get(key)!);
  list.push({ ...list[0], txId: 'tx2', amount: 1.5 }, { ...list[0], txId: 'tx3', state: 'done' });
  store.set(key, JSON.stringify(list));
  assert.deepEqual(
    loadPending('c', 'a').map((p) => p.txId),
    ['tx1'],
  );
});

const live: SignatureStatus = { confirmationStatus: 'processed', err: null };

test('a reservation keeps its nonce after the Activity entry is dismissed or trimmed', async () => {
  fakeStorage();
  await mutateReservations('c', 'a', addReservation({ txId: 'tx5', nonce: 5n, at: 1 }));
  await mutatePending('c', 'a', addEntry(entry({ txId: 'tx5', nonce: 5n, state: 'unconfirmed' })));
  await mutatePending('c', 'a', removeEntry('tx5'));
  for (let i = 0; i < 25; i++) await mutatePending('c', 'a', addEntry(entry({ txId: `filler${i}`, nonce: null })));
  const reserved = loadReservations('c', 'a');
  assert.deepEqual(reserved, [{ txId: 'tx5', nonce: 5n, at: 1 }]);
  assert.equal(planNonce(5n, reserved, [live]).nonce, 6n, 'a still-live tx keeps its nonce');
});

test('reservations are released only once the chain settles them', () => {
  const reservations = [
    { txId: 'executed', nonce: 3n },
    { txId: 'live', nonce: 4n },
    { txId: 'unknown', nonce: 5n },
    { txId: 'finalized-failed', nonce: 6n },
  ];
  const plan = planNonce(4n, reservations, [live, null, { confirmationStatus: 'finalized', err: { message: 'x' } }]);
  assert.equal(plan.nonce, 5n, 'an unknown tx is not live, so its nonce is reused rather than skipped');
  assert.deepEqual(plan.resolved.sort(), ['executed', 'finalized-failed']);
});

const signed = () => {
  const { privateKey, publicKey } = keypairFromMnemonic(createMnemonic());
  const to = bs58.encode(new Uint8Array(32).fill(7));
  return signTransfer({ privateKey, publicKey, to, amount: 10n, nonce: 2n ** 40n + 3n, fee: 100n });
};

test('the transaction id is Transaction::hash, computed before sending', () => {
  const tx = signed();
  const le = (v: bigint) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(v);
    return b;
  };
  const expected = createHash('sha256')
    .update(bs58.decode(tx.sender))
    .update(le(tx.nonce))
    .update(le(tx.fee))
    .update(bs58.decode(tx.signature))
    .digest();
  assert.equal(transactionId(tx), bs58.encode(expected));
});

function hooks() {
  const log: string[] = [];
  return {
    log,
    hooks: {
      record: async (id: string) => {
        log.push(`record:${id}`);
        return true;
      },
      rejected: async (id: string) => void log.push(`rejected:${id}`),
      acknowledged: async (local: string, node: string) => void log.push(`ack:${local}:${node}`),
    },
  };
}

test('a broadcast without an answer stays recorded under its local id', async () => {
  const tx = signed();
  const id = transactionId(tx);
  const { log, hooks: h } = hooks();
  const conn = {
    sendTransaction: async () => {
      log.push('send');
      throw new RpcError('sendTransaction', 'timeout', 'no response within 10s');
    },
  };
  await assert.rejects(broadcast(conn, tx, h), (e) => e instanceof BroadcastUncertainError && e.txId === id);
  assert.deepEqual(log, [`record:${id}`, 'send'], 'recorded before sending, never released');
});

test('a definite rejection releases the record; an acknowledgement confirms it', async () => {
  const tx = signed();
  const id = transactionId(tx);
  const rejected = hooks();
  const refusing = { sendTransaction: async () => Promise.reject(new RpcError('sendTransaction', 'rpc', 'bad nonce', -32000)) };
  await assert.rejects(broadcast(refusing, tx, rejected.hooks), /bad nonce/);
  assert.deepEqual(rejected.log, [`record:${id}`, `rejected:${id}`]);
  const acked = hooks();
  assert.deepEqual(await broadcast({ sendTransaction: async () => id }, tx, acked.hooks), { txId: id, tracked: true });
  assert.deepEqual(acked.log, [`record:${id}`, `ack:${id}:${id}`]);
  assert.equal(isDefiniteRejection(new RpcError('m', 'http', 'HTTP 502', 502)), false, 'a gateway error proves nothing');
  assert.equal(isDefiniteRejection(new RpcError('m', 'protocol', 'malformed')), false);
});

test('legacy pending entries move to the current wallet instead of disappearing', async () => {
  const store = fakeStorage();
  store.set(
    'bunkercoin.pending.v1',
    JSON.stringify([
      { txId: 'old1', kind: 'send', amount: 2500000, at: 7, to: 'bob' },
      { txId: 'old2', kind: 'faucet', amount: 1000000, at: 6, failed: 'insufficient funds' },
      { nonsense: true },
    ]),
  );
  assert.equal(await migrateLegacyPending('c', 'alice'), 2);
  assert.equal(store.has('bunkercoin.pending.v1'), false);
  const moved = loadPending('c', 'alice');
  assert.deepEqual(
    moved.map((p) => [p.txId, p.state, p.amount, p.nonce]),
    [
      ['old1', 'pending', 2500000n, null],
      ['old2', 'failed', 1000000n, null],
    ],
  );
  assert.equal(moved[1].error, 'insufficient funds');
  assert.equal(await migrateLegacyPending('c', 'alice'), 0, 'runs once');
  assert.equal(fromLegacy({ txId: 'x', kind: 'mint', amount: -1 })?.amount, 0n);
});
