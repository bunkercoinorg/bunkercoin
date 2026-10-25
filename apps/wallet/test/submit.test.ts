import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bs58 from 'bs58';
import {
  broadcast,
  BroadcastUncertainError,
  collectOutstanding,
  isDefiniteRejection,
  nextNonce,
  pauseReason,
  planNonce,
  reconcileNonce,
  resendUncertain,
  SendBlockedError,
  submitTransaction,
  withAccountLock,
  type Account,
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
  type Reservation,
} from '../src/lib/pending.ts';
import { RpcError, type SignatureStatus, type TransactionLookup } from '../src/lib/connection.ts';
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
  await mutateReservations('c', 'a', addReservation({ txId: 'tx5', nonce: 5n, at: 1, uncertain: false }));
  await mutatePending('c', 'a', addEntry(entry({ txId: 'tx5', nonce: 5n, state: 'unconfirmed' })));
  await mutatePending('c', 'a', removeEntry('tx5'));
  for (let i = 0; i < 25; i++) await mutatePending('c', 'a', addEntry(entry({ txId: `filler${i}`, nonce: null })));
  const reserved = loadReservations('c', 'a');
  assert.deepEqual(reserved, [{ txId: 'tx5', nonce: 5n, at: 1, uncertain: false }]);
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
    sendRawTransaction: async () => {
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
  const refusing = { sendRawTransaction: async () => Promise.reject(new RpcError('sendTransaction', 'rpc', 'bad nonce', -32000)) };
  await assert.rejects(broadcast(refusing, tx, rejected.hooks), /bad nonce/);
  assert.deepEqual(rejected.log, [`record:${id}`, `rejected:${id}`]);
  const acked = hooks();
  assert.deepEqual(await broadcast({ sendRawTransaction: async () => id }, tx, acked.hooks), { txId: id, tracked: true });
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

const timeout = () => new RpcError('sendTransaction', 'timeout', 'no response within 10s');

/** One wallet on a fake node: `send` scripts each broadcast, `statuses` and `nonce` are the chain's view. */
function chainAccount(send: (wire: string) => Promise<string>, lookup?: (hex: string) => Promise<TransactionLookup>) {
  const { privateKey, publicKey, address } = keypairFromMnemonic(createMnemonic());
  const chain = { nonce: 5n, statuses: new Map<string, SignatureStatus>() };
  const wires: string[] = [];
  const signed: bigint[] = [];
  let reservations: Reservation[] = [];
  let entries: PendingTx[] = [];
  const account: Account = {
    conn: {
      getNonce: async () => chain.nonce,
      getSignatureStatuses: async (ids) => ids.map((id) => chain.statuses.get(id) ?? null),
      sendRawTransaction: async (wire) => {
        wires.push(wire);
        return send(wire);
      },
      getTransaction: lookup ?? (async () => Promise.reject(new RpcError('getTransaction', 'rpc', 'upstream status 404', -32000))),
    },
    address,
    reservations: () => reservations,
    entries: () => entries,
    reserve: async (op) => {
      reservations = op(reservations);
      return true;
    },
    apply: async (op) => {
      entries = op(entries);
      return true;
    },
    track: () => {},
    untrack: () => {},
  };
  const to = bs58.encode(new Uint8Array(32).fill(9));
  const build = (nonce: bigint) => {
    signed.push(nonce);
    return signTransfer({ privateKey, publicKey, to, amount: 10n, nonce, fee: 100n });
  };
  const submit = () => submitTransaction(account, build, { kind: 'send', amount: 10n, to });
  const setEntries = (e: PendingTx[]) => void (entries = e);
  return { account, chain, wires, signed, submit, address, setEntries, state: () => ({ reservations, entries }) };
}

test('a retry after a lost acknowledgement resends the same bytes and never signs another nonce', async () => {
  const a = chainAccount(async () => Promise.reject(timeout()));
  await assert.rejects(a.submit(), BroadcastUncertainError);
  const [first] = a.wires;
  const txId = a.state().reservations[0].txId;
  assert.deepEqual(a.state().reservations[0], { txId, nonce: 5n, at: a.state().reservations[0].at, uncertain: true, wire: first });

  await assert.rejects(a.submit(), (e) => e instanceof SendBlockedError && e.txId === txId && /still has no answer/.test(e.message));
  assert.deepEqual(a.signed, [5n], 'the retry signed nothing');
  assert.equal(a.wires.length, 2);
  assert.equal(a.wires[1], first, 'the resend is byte-identical');

  // It landed after all: seen by the node, but still unacknowledged.
  a.chain.statuses.set(txId, { confirmationStatus: 'processed', err: null });
  await assert.rejects(a.submit(), (e) => e instanceof SendBlockedError && /finalizes or fails/.test(e.message));
  assert.deepEqual(a.signed, [5n], 'a processed but unacknowledged tx still blocks nonce 6');
  assert.equal(a.wires.length, 2, 'a transaction the node has seen is not resent');
  assert.equal(a.state().entries[0].state, 'pending', 'promoted out of "no answer"');

  a.chain.statuses.set(txId, { confirmationStatus: 'finalized', err: null });
  a.chain.nonce = 6n;
  await assert.rejects(a.submit(), BroadcastUncertainError);
  assert.deepEqual(a.signed, [5n, 6n], 'finalization unblocks the next nonce');
  assert.ok(!a.state().reservations.some((r) => r.txId === txId), 'the settled reservation is released');
});

test('the pause explanation follows the reservation, not the Activity label', async () => {
  const a = chainAccount(async () => Promise.reject(timeout()));
  await assert.rejects(a.submit(), BroadcastUncertainError);
  const txId = a.state().reservations[0].txId;
  const preview = () => nextNonce(a.account.conn, a.address, collectOutstanding(a.account.reservations(), a.account.entries()));

  const unseen = (await preview()).blocked;
  assert.equal(unseen.length, 1);
  assert.match(pauseReason(unseen[0]), /no answer from the node\. Sending is paused until it settles.*resends it unchanged/);

  a.chain.statuses.set(txId, { confirmationStatus: 'processed', err: null });
  a.setEntries(a.state().entries.map((p) => ({ ...p, state: 'pending' as const })));
  const seen = (await preview()).blocked;
  assert.equal(seen.length, 1, 'still blocked once Activity shows it in flight');
  assert.match(pauseReason(seen[0]), /reached the network without an acknowledgement\. Sending is paused until it finalizes or fails/);

  const { wire: _wire, ...noWire } = unseen[0].entry;
  assert.match(pauseReason({ entry: noWire, status: null }), /cannot be resent from this device\. Sending is paused/);

  a.chain.statuses.set(txId, { confirmationStatus: 'finalized', err: null });
  assert.deepEqual((await preview()).blocked, [], 'finality lifts the pause');
});

test('the chain nonce passing an uncertain broadcast unblocks sending', async () => {
  const a = chainAccount(async () => Promise.reject(timeout()));
  await assert.rejects(a.submit(), BroadcastUncertainError);
  a.chain.nonce = 6n;
  await assert.rejects(a.submit(), BroadcastUncertainError);
  assert.deepEqual(a.signed, [5n, 6n]);
});

test('a resend the node accepts or rejects settles the uncertain broadcast', async () => {
  let answer: () => Promise<string> = async () => Promise.reject(timeout());
  const a = chainAccount(() => answer());
  await assert.rejects(a.submit(), BroadcastUncertainError);
  const txId = a.state().reservations[0].txId;

  answer = async () => txId;
  assert.match((await resendUncertain(a.account, txId)) ?? '', /accepted/);
  assert.equal(a.wires[1], a.wires[0]);
  assert.equal(a.state().reservations[0].uncertain, false);
  assert.equal(a.state().entries[0].state, 'pending');
  a.chain.statuses.set(txId, { confirmationStatus: 'processed', err: null });
  answer = async () => Promise.reject(timeout());
  await assert.rejects(a.submit(), BroadcastUncertainError);
  assert.deepEqual(a.signed, [5n, 6n], 'an acknowledged live tx is advanced past');

  const held = chainAccount(async () => Promise.reject(timeout()));
  await assert.rejects(held.submit(), BroadcastUncertainError);
  const heldId = held.state().reservations[0].txId;
  held.account.conn.sendRawTransaction = async () =>
    Promise.reject(new RpcError('sendTransaction', 'rpc', 'transaction already in mempool', -32000));
  await assert.rejects(held.submit(), (e) => e instanceof SendBlockedError && /accepted/.test(e.message));
  assert.equal(held.state().reservations[0].uncertain, false, 'the node already holding it is an acknowledgement');
  assert.equal(held.state().reservations[0].txId, heldId);

  const rejecting = chainAccount(async () => Promise.reject(timeout()));
  await assert.rejects(rejecting.submit(), BroadcastUncertainError);
  rejecting.account.conn.sendRawTransaction = async () =>
    Promise.reject(new RpcError('sendTransaction', 'rpc', 'bad signature', -32000));
  await assert.rejects(rejecting.submit(), (e) => e instanceof SendBlockedError && /rejected/.test(e.message));
  assert.deepEqual(rejecting.state(), { reservations: [], entries: [] }, 'a rejection releases the nonce');
  rejecting.account.conn.sendRawTransaction = async () => Promise.reject(timeout());
  await assert.rejects(rejecting.submit(), BroadcastUncertainError);
  assert.deepEqual(rejecting.signed, [5n, 5n], 'the freed nonce is reused');
});

test('legacy migration keeps every entry past the cap and the v1 key until all are stored', async () => {
  const store = fakeStorage();
  for (let i = 0; i < 5; i++) await mutatePending('c', 'alice', addEntry(entry({ txId: `now${i}`, state: 'failed' })));
  const legacy = Array.from({ length: 25 }, (_, i) => ({ txId: `old${i}`, kind: 'send', amount: 1, at: i, failed: i % 2 ? 'x' : undefined }));
  store.set('bunkercoin.pending.v1', JSON.stringify(legacy));
  assert.equal(await migrateLegacyPending('c', 'alice'), 25);
  assert.equal(loadPending('c', 'alice').length, 30, 'migration is not trimmed');
  assert.equal(store.has('bunkercoin.pending.v1'), false);
  await mutatePending('c', 'alice', addEntry(entry({ txId: 'next' })));
  const after = loadPending('c', 'alice');
  assert.equal(after.length, 20, 'later writes trim failed entries only');
  assert.equal(after.filter((p) => p.state === 'pending').length, 14, 'no open entry is dropped');

  const failing = fakeStorage();
  failing.set('bunkercoin.pending.v1', JSON.stringify(legacy.slice(0, 2)));
  const real = localStorage.setItem;
  localStorage.setItem = (k: string, v: string) => {
    if (k.startsWith('bunkercoin.pending.v2')) throw new Error('QuotaExceededError');
    real(k, v);
  };
  assert.equal(await migrateLegacyPending('c', 'alice'), 0);
  assert.ok(failing.has('bunkercoin.pending.v1'), 'the v1 list survives a failed write');
});

test('a legacy send blocks signing until the node gives its nonce', async () => {
  const legacyId = bs58.encode(new Uint8Array(32).fill(3));
  let lookup: (hex: string) => Promise<TransactionLookup> = async () => Promise.reject(new RpcError('getTransaction', 'rpc', 'upstream status 404', -32000));
  const a = chainAccount(async () => Promise.reject(timeout()), (hex) => lookup(hex));
  a.setEntries([entry({ txId: legacyId, nonce: null, state: 'pending' })]);
  await assert.rejects(a.submit(), (e) => e instanceof SendBlockedError && e.txId === legacyId && /before this wallet update/.test(e.message));
  assert.deepEqual(a.signed, []);

  const asked: string[] = [];
  lookup = async (hex) => {
    asked.push(hex);
    return { sender: a.address, nonce: 5n, location: 'mempool' };
  };
  a.chain.statuses.set(legacyId, { confirmationStatus: 'processed', err: null });
  await assert.rejects(a.submit(), BroadcastUncertainError);
  assert.deepEqual(asked, [Buffer.from(bs58.decode(legacyId)).toString('hex')], 'looked up by hex hash');
  assert.deepEqual(a.signed, [6n], 'signed past the live legacy nonce');
  assert.equal(a.state().entries.find((p) => p.txId === legacyId)?.nonce, 5n);
  assert.ok(a.state().reservations.some((r) => r.txId === legacyId && r.nonce === 5n && !r.uncertain));
});
