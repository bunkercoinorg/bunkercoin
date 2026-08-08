import test from 'node:test';
import assert from 'node:assert/strict';
import { BunkerConnection } from '../src/lib/connection.ts';

interface RpcCall {
  id: number;
  method: string;
  params: unknown[];
}

// Mock server so tests bind the wire contract without touching production.
function mockConnection(handler: (method: string, params: unknown[]) => unknown) {
  const conn = new BunkerConnection('http://mock/');
  const calls: RpcCall[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const req = JSON.parse(String(init?.body)) as RpcCall;
    calls.push(req);
    const result = handler(req.method, req.params);
    return {
      ok: true,
      json: async () =>
        result instanceof Error
          ? { jsonrpc: '2.0', id: req.id, error: { code: -32000, message: result.message } }
          : { jsonrpc: '2.0', id: req.id, result },
    };
  }) as unknown as typeof fetch;
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
  assert.ok(sent);
  assert.deepEqual(JSON.parse(atob(String(sent.params[0]))), tx);
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
  const statuses: (string | undefined)[] = [];
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

test('getTokenBalances unwraps the node {value:{pubkey,tokens}} shape', async () => {
  // The real node nests balances under value.tokens, not value itself.
  const { conn } = mockConnection(() => ({
    context: { slot: 1 },
    value: { pubkey: 'addr', tokens: [{ ticker: 'BNKTEST', balance: 1_000_000 }] },
  }));
  const tokens = await conn.getTokenBalances('addr');
  assert.ok(Array.isArray(tokens), 'must always return an array');
  assert.equal(tokens[0]?.ticker, 'BNKTEST');
});

test('getTokenBalances returns an array for accounts holding nothing', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: null }));
  assert.deepEqual(await conn.getTokenBalances('addr'), []);
});
