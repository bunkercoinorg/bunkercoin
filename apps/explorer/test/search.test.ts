import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyQuery, matchContext, resolveSearch, searchOutcome, type SearchProbes } from '../lib/search.ts';
import { bytesToBase58 as base58Encode, bytesToHex as hexEncode } from '@bunkercoin/chain-format';
import type { AccountDetails, Block } from '../lib/types.ts';

const HASH = 'ab'.repeat(32);
const account = (over: Partial<AccountDetails> = {}): AccountDetails => ({
  pubkey: HASH,
  native_balance: 0n,
  token_balances: {},
  nonce: 0n,
  ...over,
});

function probes(found: Partial<Record<keyof SearchProbes, unknown>>, calls: string[] = []): SearchProbes {
  const probe = (k: keyof SearchProbes) => async (id: string) => {
    calls.push(`${k}:${id}`);
    const v = found[k];
    return (v instanceof Error ? Promise.reject(v) : (v ?? null)) as never;
  };
  return {
    transaction: probe('transaction'),
    block: probe('block'),
    blockBySlot: probe('blockBySlot'),
    token: probe('token'),
    account: probe('account'),
  };
}

test('an 8-digit numeric string is both a slot and a token id', () => {
  assert.deepEqual(classifyQuery('00000001'), [
    { kind: 'block', id: '1' },
    { kind: 'token', id: '00000001' },
  ]);
});

test('short numbers are slots, 8-hex with letters are tokens', () => {
  assert.deepEqual(classifyQuery(' 42 '), [{ kind: 'block', id: '42' }]);
  assert.deepEqual(classifyQuery('DEADBEEF'), [{ kind: 'token', id: 'deadbeef' }]);
});

test('32-byte values in hex or base58 are tx, block, or account', () => {
  const expected = [
    { kind: 'transaction', id: HASH },
    { kind: 'block', id: HASH },
    { kind: 'account', id: HASH },
  ];
  assert.deepEqual(classifyQuery(HASH), expected);
  const b58 = base58Encode(new Uint8Array(32).fill(0xab));
  assert.deepEqual(classifyQuery(b58), expected);
});

test('skip ids, out-of-range slots, and junk', () => {
  assert.deepEqual(classifyQuery('skip-12'), [{ kind: 'block', id: 'skip-12' }]);
  assert.deepEqual(classifyQuery('99999999999999999999999'), []);
  assert.deepEqual(classifyQuery('not an id!'), []);
  assert.deepEqual(classifyQuery('   '), []);
});

test('ambiguous slot/token returns every match that exists', async () => {
  const both = await resolveSearch('00000001', probes({ blockBySlot: {}, token: {} }));
  assert.deepEqual(
    both.map((m) => [m.kind, m.id]),
    [
      ['block', '1'],
      ['token', '00000001'],
    ],
  );
  const tokenOnly = await resolveSearch('00000001', probes({ token: {} }));
  assert.deepEqual(tokenOnly.map((m) => m.kind), ['token']);
});

test('token ids are probed, never assumed', async () => {
  const calls: string[] = [];
  assert.deepEqual(await resolveSearch('deadbeef', probes({}, calls)), []);
  assert.deepEqual(calls, ['token:deadbeef']);
});

test('a zeroed account is an explicit no-activity candidate, never filtered out', async () => {
  const fresh = await resolveSearch(HASH, probes({ account: account() }));
  assert.deepEqual(fresh.map((m) => [m.kind, m.inactive]), [['account', true]]);
  assert.match(fresh[0].label, /no activity yet/);
  const active = await resolveSearch(HASH, probes({ account: account({ nonce: 1n }) }));
  assert.deepEqual(active.map((m) => [m.kind, m.inactive]), [['account', undefined]]);
  const holder = await resolveSearch(HASH, probes({ account: account({ token_balances: { deadbeef: 3n } }) }));
  assert.deepEqual(holder.map((m) => [m.kind, m.inactive]), [['account', undefined]]);
});

test('a zeroed account is offered as a choice, never routed to', async () => {
  const fresh = await resolveSearch(HASH, probes({ account: account() }));
  assert.deepEqual(searchOutcome(fresh), { kind: 'choose', matches: fresh });
  const withTx = await resolveSearch(HASH, probes({ transaction: {}, account: account() }));
  const routed = searchOutcome(withTx);
  assert.equal(routed.kind, 'route');
  assert.equal(routed.kind === 'route' && routed.match.kind, 'transaction');
  const active = await resolveSearch(HASH, probes({ account: account({ nonce: 1n }) }));
  assert.equal(searchOutcome(active).kind, 'route');
  const both = await resolveSearch('00000001', probes({ blockBySlot: {}, token: {} }));
  assert.equal(searchOutcome(both).kind, 'choose');
  assert.deepEqual(searchOutcome([]), { kind: 'none' });
});

test('a tx hit is labelled in base58 and routed by hex', async () => {
  const [m] = await resolveSearch(HASH, probes({ transaction: {} }));
  assert.equal(m.kind, 'transaction');
  assert.equal(m.id, HASH);
  assert.equal(m.label, `Transaction ${base58Encode(new Uint8Array(32).fill(0xab))}`);
});

test('probe failures reject instead of reporting nothing found', async () => {
  await assert.rejects(resolveSearch('5', probes({ blockBySlot: new Error('down') })));
});

test('base58 input is normalized to hex before probing', async () => {
  const calls: string[] = [];
  const key = new Uint8Array(32).fill(9);
  await resolveSearch(base58Encode(key), probes({}, calls));
  assert.ok(calls.includes(`transaction:${hexEncode(key)}`));
});

test('a prefix keeps only that kind of candidate', () => {
  assert.deepEqual(classifyQuery('slot:00000001').map((c) => c.kind), ['block']);
  assert.deepEqual(classifyQuery('token:00000001').map((c) => [c.kind, c.id]), [['token', '00000001']]);
  assert.deepEqual(classifyQuery('TX: ' + 'ab'.repeat(32)).map((c) => c.kind), ['transaction']);
  assert.deepEqual(classifyQuery('slot:' + 'ab'.repeat(32)), []);
  assert.deepEqual(classifyQuery('account:12'), []);
});

test('matches carry the probed record and a context line', async () => {
  const block: Block = { type: 'block', slot: 1, hash: HASH, status: 'finalized', finalized_timestamp: 1_000 };
  const token = { id: '00000001', ticker: 'RADIO', current_supply: 1_000_000n };
  const [b, t] = await resolveSearch('00000001', probes({ blockBySlot: block, token }));
  assert.equal(b.block, block);
  assert.equal(t.token, token);
  assert.equal(matchContext(b, 7_000), 'finalized · 6s ago');
  assert.equal(matchContext(b, null), 'finalized');
  assert.equal(matchContext(t, null), 'RADIO · supply 1,000,000');
  const skip = { ...b, block: { ...block, type: 'skip' as const, finalized_timestamp: undefined } };
  assert.equal(matchContext(skip, 7_000), 'skipped');
  const [tx] = await resolveSearch('tx:' + HASH, probes({ transaction: { status: { location: 'finalized', slot: 48_219, success: false } } }));
  assert.equal(matchContext(tx, null), 'finalized · slot 48,219 · failed');
  const [idle] = await resolveSearch('account:' + HASH, probes({ account: account() }));
  assert.equal(matchContext(idle, null), 'address with no recorded activity');
  const [rich] = await resolveSearch('account:' + HASH, probes({ account: account({ native_balance: 2_500_000n, token_balances: { deadbeef: 3n } }) }));
  assert.equal(matchContext(rich, null), '2.500000 BUNKER · 1 token');
});
