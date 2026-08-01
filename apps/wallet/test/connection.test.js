import test from 'node:test';
import assert from 'node:assert/strict';
import { BunkerConnection } from '../src/lib/connection.js';

// Mock server so tests bind the wire contract without touching production.
function mockConnection(handler) {
  const conn = new BunkerConnection('http://mock/');
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const req = JSON.parse(init.body);
    calls.push(req);
    const result = handler(req.method, req.params);
    return {
      ok: true,
      json: async () =>
        result instanceof Error
          ? { jsonrpc: '2.0', id: req.id, error: { code: -32000, message: result.message } }
          : { jsonrpc: '2.0', id: req.id, result },
    };
  };
  return { conn, calls };
}

test('getBalance unwraps the RpcResponse envelope', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: 4200 }));
  assert.equal(await conn.getBalance('addr'), 4200);
});

test('getNonce returns 0 for accounts the chain has never seen', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: null }));
  assert.equal(await conn.getNonce('fresh-addr'), 0);
});

test('sendTransaction base64-encodes the tx JSON', async () => {
  const { conn, calls } = mockConnection(() => 'tx-id-b58');
  const tx = { sender: 'a', nonce: 0, fee: 100, signature: 's', body: { Transfer: { to: 'b', amount: 1 } } };
  assert.equal(await conn.sendTransaction(tx), 'tx-id-b58');
  const sent = calls.find((c) => c.method === 'sendTransaction');
  assert.deepEqual(JSON.parse(atob(sent.params[0])), tx);
});

test('rpc errors surface with the method name', async () => {
  const { conn } = mockConnection(() => new Error('account not found'));
  await assert.rejects(conn.getBalance('x'), /getBalance: account not found/);
});

test('confirm resolves when status reaches finalized', async () => {
  let polls = 0;
  const { conn } = mockConnection((method) => {
    if (method !== 'getSignatureStatuses') throw new Error('unexpected');
    polls++;
    return {
      context: { slot: 1 },
      value: [polls < 3 ? { confirmationStatus: 'processed', err: null } : { confirmationStatus: 'finalized', err: null }],
    };
  });
  const statuses = [];
  const status = await conn.confirm('id', { pollMs: 1, onStatus: (s) => statuses.push(s?.confirmationStatus) });
  assert.equal(status.confirmationStatus, 'finalized');
  assert.ok(statuses.includes('processed'), 'UI must see the processed state');
});

test('confirm rejects when the transaction errs', async () => {
  const { conn } = mockConnection(() => ({
    context: { slot: 1 },
    value: [{ confirmationStatus: 'processed', err: { message: 'insufficient balance' } }],
  }));
  await assert.rejects(conn.confirm('id', { pollMs: 1 }), /insufficient balance/);
});

test('confirm survives transient rpc failures between polls', async () => {
  let polls = 0;
  const { conn } = mockConnection(() => {
    polls++;
    if (polls === 1) return new Error('bastion hiccup');
    return { context: { slot: 1 }, value: [{ confirmationStatus: 'finalized', err: null }] };
  });
  const status = await conn.confirm('id', { pollMs: 1 });
  assert.equal(status.confirmationStatus, 'finalized');
});

test('confirm times out with a non-fatal message', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: [null] }));
  await assert.rejects(conn.confirm('id', { pollMs: 1, timeoutMs: 10 }), /may still finalize/);
});
