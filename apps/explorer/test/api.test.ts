import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError } from '../lib/api.ts';

const HASH = 'ab'.repeat(32);
const realFetch = globalThis.fetch;
const urls: string[] = [];

function respond(impl: () => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return impl();
  }) as typeof fetch;
}

const json = (body: string, status = 200) => () => new Response(body, { status });

afterEach(() => {
  globalThis.fetch = realFetch;
  urls.length = 0;
});

async function rejectsWith(p: Promise<unknown>, kind: ApiError['kind'], status?: number) {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof ApiError, String(e));
    assert.equal(e.kind, kind);
    if (status !== undefined) assert.equal(e.status, status);
    return true;
  });
}

test('404 is absence, and only for lookups', async () => {
  respond(json('', 404));
  assert.equal(await api.getAccount(HASH), null);
  await rejectsWith(api.getBlocks(0, 20), 'http', 404);
});

test('other HTTP failures throw with their status', async () => {
  respond(json('oops', 500));
  await rejectsWith(api.getAccount(HASH), 'http', 500);
  respond(json('', 503));
  await rejectsWith(api.getBlocks(0, 20), 'http', 503);
});

test('a network failure is a network error, an abort stays an abort', async () => {
  respond(() => Promise.reject(new TypeError('fetch failed')));
  await rejectsWith(api.getAccount(HASH), 'network');
  respond(() => Promise.reject(new DOMException('aborted', 'AbortError')));
  await assert.rejects(api.getAccount(HASH), (e: unknown) => e instanceof DOMException && e.name === 'AbortError');
});

test('invalid JSON, a wrong shape, and a successful null are shape errors', async () => {
  respond(json('{"pubkey":'));
  await rejectsWith(api.getAccount(HASH), 'shape');
  respond(json('{"native_balance":1}'));
  await rejectsWith(api.getAccount(HASH), 'shape');
  respond(json('null'));
  await rejectsWith(api.getAccount(HASH), 'shape');
  respond(json('[{"type":"block","slot":"x","hash":"h","status":"finalized"}]'));
  await rejectsWith(api.getBlocks(0, 20), 'shape');
});

test('a valid answer is parsed losslessly from the encoded path', async () => {
  respond(json(`{"pubkey":"${HASH}","native_balance":18446744073709551615,"nonce":2,"token_balances":{}}`));
  const a = await api.getAccount(HASH);
  assert.equal(a?.native_balance, 18446744073709551615n);
  assert.equal(a?.nonce, 2n);
  assert.match(urls[0], new RegExp(`/accounts/${HASH}$`));
});

test('malformed ids never reach the network', async () => {
  respond(() => {
    throw new Error('unexpected fetch');
  });
  assert.equal(await api.getAccount('not a key'), null);
  assert.equal(await api.getTransaction('zz'), null);
  assert.equal(urls.length, 0);
});

test('the token registry keeps creator and metadata hash', async () => {
  respond(json(`{"tokens":[{"id":"01000000","ticker":"RADIO","current_supply":5,"max_supply":9,"metadata_hash":"${HASH}","creator":"${HASH}"}]}`));
  const [t] = await api.getTokens();
  assert.deepEqual(t, { id: '01000000', ticker: 'RADIO', current_supply: 5n, max_supply: 9n, creator: HASH, metadata_hash: HASH });
  assert.ok(urls[0].endsWith('/tokens'));
  respond(json('{"tokens":[{"id":"01000000"}]}'));
  await rejectsWith(api.getTokens(), 'shape');
});

test('a mint body carries ticker, max supply and metadata hash', async () => {
  respond(
    json(
      `{"hash":"${HASH}","sender":"${HASH}","nonce":1,"fee":100,"body":{"type":"Mint","ticker":"RADIO","max_supply":18446744073709551615,"metadata_hash":"${HASH}"},"status":{"location":"mempool"}}`,
    ),
  );
  const tx = await api.getTransaction(HASH);
  assert.deepEqual(tx?.body, { type: 'Mint', to: undefined, amount: undefined, token_id: undefined, ticker: 'RADIO', max_supply: 18446744073709551615n, metadata_hash: HASH });
});
