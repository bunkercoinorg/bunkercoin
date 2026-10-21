import test from 'node:test';
import assert from 'node:assert/strict';
import { BunkerConnection, ConfirmTimeoutError, MAX_FEE_UNITS, RpcError } from '../src/lib/connection.ts';
import { parseJson, stringifyJson } from '../src/lib/json.ts';

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
    if (typeof result === 'object' && result !== null && 'raw' in result) {
      return { ok: true, text: async () => (result as { raw: string }).raw.replace('$ID', String(req.id)) };
    }
    return {
      ok: true,
      text: async () =>
        stringifyJson(
          result instanceof Error
            ? { jsonrpc: '2.0', id: req.id, error: { code: -32000, message: result.message } }
            : { jsonrpc: '2.0', id: req.id, result },
        ),
    };
  }) as unknown as typeof fetch;
  return { conn, calls };
}

test('getBalance unwraps the RpcResponse envelope', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: 4200 }));
  assert.equal(await conn.getBalance('addr'), 4200n);
});

test('getNonce returns 0 for accounts the chain has never seen', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: null }));
  assert.equal(await conn.getNonce('fresh-addr'), 0n);
});

test('sendTransaction base64-encodes the tx JSON', async () => {
  const { conn, calls } = mockConnection(() => 'tx-id-b58');
  const tx = { sender: 'a', nonce: 0n, fee: 100n, signature: 's', body: { Transfer: { to: 'b', amount: 1n } } };
  assert.equal(await conn.sendTransaction(tx), 'tx-id-b58');
  const sent = calls.find((c) => c.method === 'sendTransaction');
  assert.ok(sent);
  assert.deepEqual(parseJson(atob(String(sent.params[0]))), tx);
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
    value: { pubkey: 'addr', tokens: [{ token_id: '01000000', ticker: 'BNKTEST', balance: 1_000_000 }] },
  }));
  const tokens = await conn.getTokenBalances('addr');
  assert.ok(Array.isArray(tokens), 'must always return an array');
  assert.equal(tokens[0]?.ticker, 'BNKTEST');
});

test('token records carry the metadata hash and the creator as a base58 address', async () => {
  const creatorHex = '11'.repeat(32);
  const meta = { id: '01000000', ticker: 'RADIO', current_supply: 5, max_supply: 9, metadata_hash: 'ab'.repeat(32), creator: creatorHex };
  const expected = {
    id: '01000000',
    ticker: 'RADIO',
    currentSupply: 5n,
    maxSupply: 9n,
    metadataHash: 'ab'.repeat(32),
    creator: '29d2S7vB453rNYFdR5Ycwt7y9haRT5fwVwL9zTmBhfV2',
  };
  const { conn, calls } = mockConnection((method) => {
    if (method === 'getTokens') return { tokens: [meta] };
    if (method === 'getToken') return meta;
    return {
      context: { slot: 1 },
      value: {
        pubkey: 'addr',
        tokens: [{ token_id: '01000000', balance: 1, ticker: 'RADIO', metadata_hash: 'ab'.repeat(32), creator: creatorHex }, { token_id: '02000000', balance: 2 }],
      },
    };
  });
  assert.deepEqual(await conn.getTokens(), [expected]);
  assert.deepEqual(await conn.getToken('01000000'), expected);
  assert.deepEqual(calls.at(-1)?.params, ['01000000']);
  const [held, bare] = await conn.getTokenBalances('addr');
  assert.equal(held.metadataHash, 'ab'.repeat(32));
  assert.equal(held.creator, expected.creator);
  assert.equal(bare.metadataHash, null);
  assert.equal(bare.creator, null);
});

test('getToken is null for an unknown token and rejects malformed records', async () => {
  const { conn: missing } = mockConnection(() => new Error('token not found'));
  assert.equal(await missing.getToken('09000000'), null);
  const { conn: broken } = mockConnection(() => ({ id: '01000000', ticker: 'X', current_supply: 1, max_supply: 1, metadata_hash: 'AB', creator: '11'.repeat(32) }));
  await assert.rejects(broken.getToken('01000000'), /metadata hash/);
});

test('UpdateMetadata transactions decode with their token and hash', async () => {
  const { conn } = mockConnection(() => ({ transactions: [tx({ body: { type: 'UpdateMetadata', token_id: '01000000', metadata_hash: 'cd'.repeat(32) } })] }));
  const [update] = await conn.getTransactions();
  assert.deepEqual(update.body, { type: 'UpdateMetadata', tokenId: '01000000', metadataHash: 'cd'.repeat(32) });
});

test('getTokenBalances returns an array for accounts holding nothing', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: null }));
  assert.deepEqual(await conn.getTokenBalances('addr'), []);
});

const HEX_A = 'aa'.repeat(32);
const HEX_B = 'bb'.repeat(32);
const tx = (over: Record<string, unknown>) => ({
  hash: '11'.repeat(32),
  sender: HEX_A,
  nonce: 0,
  fee: 100,
  slot: 7,
  block_hash: '22'.repeat(32),
  body: { type: 'Transfer', to: HEX_B, amount: 5 },
  status: { location: 'finalized', slot: 7, success: true, error: null },
  ...over,
});

test('u64 balances above 2^53 arrive exact', async () => {
  const { conn } = mockConnection(() => ({ raw: '{"jsonrpc":"2.0","id":$ID,"result":{"context":{"slot":1},"value":18446744073709551615}}' }));
  assert.equal(await conn.getBalance('addr'), 18446744073709551615n);
});

test('responses for another request id are rejected', async () => {
  const { conn } = mockConnection(() => ({ raw: '{"jsonrpc":"2.0","id":999,"result":{"context":{"slot":1},"value":1}}' }));
  await assert.rejects(conn.getBalance('addr'), (e) => e instanceof RpcError && e.kind === 'protocol');
});

test('malformed results are protocol errors, not zero', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: 'lots' }));
  await assert.rejects(conn.getBalance('addr'), (e) => e instanceof RpcError && e.kind === 'protocol');
  const { conn: c2 } = mockConnection(() => ({ raw: 'not json' }));
  await assert.rejects(c2.getBalance('addr'), (e) => e instanceof RpcError && e.kind === 'protocol');
});

test('a hanging request times out instead of blocking forever', async () => {
  const conn = new BunkerConnection('http://mock/');
  globalThis.fetch = ((_u: unknown, init?: RequestInit) =>
    new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
  await assert.rejects(conn.rpc('getSlot', [], { timeoutMs: 20 }), (e) => e instanceof RpcError && e.kind === 'timeout');
  const ctrl = new AbortController();
  const pending = conn.rpc('getSlot', [], { signal: ctrl.signal });
  ctrl.abort();
  await assert.rejects(pending, (e) => e instanceof RpcError && e.kind === 'aborted');
});

test('confirm honours its deadline even when every request hangs', async () => {
  const conn = new BunkerConnection('http://mock/');
  globalThis.fetch = ((_u: unknown, init?: RequestInit) =>
    new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
  const start = Date.now();
  await assert.rejects(conn.confirm('id', { pollMs: 1, timeoutMs: 50 }), /may still finalize/);
  assert.ok(Date.now() - start < 2_000);
});

test('fees above the wallet cap are refused', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: MAX_FEE_UNITS + 1n }));
  await assert.rejects(conn.getFee(), /above the wallet cap/);
  const { conn: ok } = mockConnection(() => ({ context: { slot: 1 }, value: 100 }));
  assert.equal(await ok.getFee(), 100n);
});

test('token balances without a valid token id are rejected', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: { pubkey: 'a', tokens: [{ ticker: 'X', balance: 1 }] } }));
  await assert.rejects(conn.getTokenBalances('a'), /token id/);
});

test('transaction kinds and outcomes are modelled, not guessed', async () => {
  const { conn } = mockConnection(() => ({
    transactions: [
      tx({ body: { type: 'Mint', ticker: 'BNK', max_supply: 1000, metadata_hash: '00'.repeat(32) } }),
      tx({ status: { location: 'confirmed', slot: 7, block_hash: '22'.repeat(32) } }),
      tx({ status: { location: 'finalized', slot: 7, success: false, error: 'insufficient balance' } }),
      tx({ body: { type: 'Bond', validator: HEX_B, amount: 1 } }),
    ],
  }));
  const [mint, unknown, failed, other] = await conn.getTransactions();
  assert.deepEqual(mint.body, { type: 'Mint', ticker: 'BNK', maxSupply: 1000n, metadataHash: '00'.repeat(32) });
  assert.deepEqual(mint.outcome, { kind: 'success' });
  assert.deepEqual(unknown.outcome, { kind: 'unknown' });
  assert.deepEqual(failed.outcome, { kind: 'failed', error: 'insufficient balance' });
  assert.deepEqual(other.body, { type: 'Other', name: 'Bond' });
});

test('account history pages past unrelated traffic', async () => {
  const { conn, calls } = mockConnection((_m, params) => {
    const offset = Number(params[1]);
    const page = Array.from({ length: 200 }, (_, i) =>
      tx({ hash: (offset + i).toString(16).padStart(64, '0'), sender: offset === 400 && i < 3 ? 'dd'.repeat(32) : 'cc'.repeat(32) }),
    );
    return { transactions: page };
  });
  const history = await conn.getAccountHistory('dd'.repeat(32), { want: 10, maxPages: 3 });
  assert.equal(calls.length, 3);
  assert.equal(history.transactions.length, 3);
  assert.equal(history.scanned, 600);
  assert.equal(history.end, 'scan-limit');
});

test('account history tells enough results apart from an exhausted list', async () => {
  const me = 'dd'.repeat(32);
  const { conn } = mockConnection((_m, params) => {
    const offset = Number(params[1]);
    const size = offset === 0 ? 200 : 50;
    return {
      transactions: Array.from({ length: size }, (_, i) =>
        tx({ hash: (offset + i).toString(16).padStart(64, '0'), sender: i % 20 === 0 ? me : 'cc'.repeat(32) }),
      ),
    };
  });
  assert.equal((await conn.getAccountHistory(me, { want: 10 })).end, 'enough');
  const all = await conn.getAccountHistory(me, { want: 100 });
  assert.equal(all.end, 'exhausted');
  assert.equal(all.scanned, 250);
});

test('a finalized status without an explicit outcome is malformed, not a success', async () => {
  const { conn } = mockConnection(() => ({ context: { slot: 1 }, value: [{ confirmationStatus: 'finalized' }] }));
  await assert.rejects(conn.getSignatureStatus('id'), (e) => e instanceof RpcError && e.kind === 'protocol');
  await assert.rejects(conn.confirm('id', { pollMs: 1, timeoutMs: 30 }), ConfirmTimeoutError);
});

test('the Solana status field counts as an explicit outcome', async () => {
  const { conn } = mockConnection((_m, params) => ({
    context: { slot: 1 },
    value: (params[0] as string[]).map((id) =>
      id === 'ok'
        ? { confirmationStatus: 'finalized', status: { Ok: null } }
        : { confirmationStatus: 'finalized', status: { Err: { message: 'nonce too low' } } },
    ),
  }));
  const [ok, failed] = await conn.getSignatureStatuses(['ok', 'bad']);
  assert.equal(ok?.err, null);
  assert.deepEqual(failed?.err, { message: 'nonce too low' });
});
