import test from 'node:test';
import assert from 'node:assert/strict';
import { stringifyJson } from '@bunkercoin/chain-format';
import { BunkerConnection } from '../src/lib/connection.ts';
import {
  blockIntervals,
  cadenceHint,
  duplicatePrompt,
  findDuplicate,
  inflightSummary,
  nativeSpendable,
  phaseLabel,
  phaseOf,
  spendableTokens,
  titleWithCount,
} from '../src/lib/inflight.ts';
import { addressToHex } from '../src/lib/keys.ts';
import { loadPending, mutatePending, phaseEntry, addEntry, type PendingTx } from '../src/lib/pending.ts';

const TO = '8Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx';
const MIN = 60_000;

const entry = (p: Partial<PendingTx>): PendingTx => ({
  txId: `tx${Math.random()}`,
  kind: 'send',
  amount: 250_000n,
  at: 0,
  nonce: 0n,
  state: 'pending',
  fee: 100n,
  to: TO,
  ...p,
});

test('spendable nets in-flight sends and every fee out of the balance; faucet stays apart', () => {
  const pending = [
    entry({}),
    entry({ kind: 'token-send', amount: 40n, tokenId: '01000000', fee: 100n }),
    entry({ kind: 'mint', amount: 1000n, fee: 100n, to: undefined }),
    entry({ state: 'uncertain', amount: 5n, fee: 1n }),
    entry({ state: 'unconfirmed', amount: 7n, fee: 1n }),
    entry({ state: 'failed', amount: 999_999n }),
    entry({ kind: 'faucet', amount: 1_000_000n, fee: undefined, nonce: null, to: undefined }),
  ];
  assert.deepEqual(nativeSpendable(1_000_000n, pending), {
    available: 1_000_000n - (250_000n + 100n) - 100n - 100n - 6n - 8n,
    pendingOut: 250_000n + 100n + 100n + 100n + 6n + 8n,
    pendingIn: 1_000_000n,
  });
  assert.equal(nativeSpendable(100n, pending).available, 0n);
  assert.equal(nativeSpendable(null, pending).available, null);
  assert.deepEqual(nativeSpendable(5n, []), { available: 5n, pendingOut: 0n, pendingIn: 0n });
});

test('token balances lose only their own in-flight sends', () => {
  const tokens = [
    { tokenId: '01000000', ticker: 'RADIO', balance: 100n, metadataHash: null },
    { tokenId: '02000000', ticker: 'WAVE', balance: 9n, metadataHash: null },
  ];
  const pending = [
    entry({ kind: 'token-send', amount: 30n, tokenId: '01000000' }),
    entry({ kind: 'token-send', amount: 500n, tokenId: '01000000', state: 'uncertain' }),
    entry({ kind: 'token-send', amount: 1n, tokenId: '02000000', state: 'failed' }),
    entry({ kind: 'token-send', amount: 1n, ticker: 'WAVE · 02000000' }),
  ];
  const out = spendableTokens(tokens as never, pending);
  assert.deepEqual(
    out.map((t) => [t.tokenId, t.balance]),
    [
      ['01000000', 0n],
      ['02000000', 9n],
    ],
  );
  assert.equal(out[0].ticker, 'RADIO');
});

test('a duplicate is the same asset, amount and recipient while still in flight', () => {
  const first = entry({ at: 10 * MIN });
  const pending = [first, entry({ kind: 'token-send', amount: 5n, tokenId: '01000000' })];
  assert.equal(findDuplicate(pending, { kind: 'send', to: TO, amount: 250_000n }), first);
  assert.equal(findDuplicate(pending, { kind: 'send', to: ` ${addressToHex(TO)} `, amount: 250_000n }), first);
  assert.equal(findDuplicate(pending, { kind: 'send', to: TO, amount: 250_001n }), null);
  assert.equal(findDuplicate(pending, { kind: 'token-send', to: TO, amount: 250_000n, tokenId: '01000000' }), null);
  assert.ok(findDuplicate(pending, { kind: 'token-send', to: TO, amount: 5n, tokenId: '01000000' }));
  assert.equal(findDuplicate(pending, { kind: 'token-send', to: TO, amount: 5n, tokenId: '02000000' }), null);
  assert.equal(findDuplicate([{ ...first, state: 'failed' }], { kind: 'send', to: TO, amount: 250_000n }), null);
  assert.equal(
    duplicatePrompt('0.250000 BUNKER', TO, first.at, 13 * MIN),
    'You already sent 0.250000 BUNKER to 8Ep5…suHx 3 min ago. Send again?',
  );
});

test('processed is never progress: only a transaction lookup places it in a block', () => {
  const processed = { confirmationStatus: 'processed' as const, err: null };
  assert.equal(phaseOf(processed, null), null);
  assert.equal(phaseOf(processed, 'mempool'), 'mempool');
  assert.equal(phaseOf(processed, 'confirmed'), 'block');
  assert.equal(phaseOf({ confirmationStatus: 'processed', err: 'x' }, 'confirmed'), null);
  assert.equal(phaseLabel(entry({})), 'sent · waiting for a block');
  assert.equal(phaseLabel(entry({ kind: 'faucet' })), 'requested · waiting for a block');
  assert.equal(phaseLabel(entry({ phase: 'mempool' })), 'in mempool · waiting for a block');
  assert.equal(phaseLabel(entry({ phase: 'block' })), 'in block · finalizing');
  assert.equal(phaseLabel(entry({ state: 'uncertain', phase: 'block' })), 'no answer from the node');
});

test('a mempool status carrying the current slot decodes as processed, not finalized', async () => {
  const conn = new BunkerConnection('http://mock/');
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    const { id } = JSON.parse(String(init?.body)) as { id: number };
    const result = { context: { slot: 900 }, value: [{ slot: 900, confirmations: null, err: null, confirmationStatus: 'processed' }] };
    return { ok: true, text: async () => stringifyJson({ jsonrpc: '2.0', id, result }) };
  }) as unknown as typeof fetch;
  const [s] = await conn.getSignatureStatuses(['a']);
  assert.deepEqual(s, { confirmationStatus: 'processed', err: null });
  assert.equal(phaseOf(s, null), null);
});

test('block times come from finalized blocks only, seconds scaled to ms', async () => {
  const conn = new BunkerConnection('http://mock/');
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    const { id } = JSON.parse(String(init?.body)) as { id: number };
    const result = [
      { type: 'block', slot: 3, status: 'finalized', finalized_timestamp: 1_700_000_600 },
      { type: 'block', slot: 2, status: 'proposed', proposed_timestamp: 1_700_000_500_000 },
      { type: 'skip', slot: 1, status: 'finalized' },
      { type: 'block', slot: 0, status: 'finalized', finalized_timestamp: 1_700_000_000_000 },
    ];
    return { ok: true, text: async () => stringifyJson({ jsonrpc: '2.0', id, result }) };
  }) as unknown as typeof fetch;
  assert.deepEqual(await conn.getBlockTimes(), [1_700_000_600_000, 1_700_000_000_000]);
});

test('cadence hint: one to three median intervals, coarse, and silent until a few were seen', () => {
  const at = (mins: number[]) => mins.map((m) => m * MIN);
  assert.deepEqual(blockIntervals(at([30, 10, 20, 20, 0])), at([10, 10, 10]));
  assert.equal(cadenceHint(at([8, 8])), null);
  assert.equal(cadenceHint(at([8, 6, 9, 40, 7])), 'usually 8-25 min');
  assert.equal(cadenceHint(at([12, 15, 18])), 'usually 15-45 min');
  assert.equal(cadenceHint(at([0.5, 0.4, 0.6])), 'usually 1-2 min');
  assert.equal(cadenceHint(at([40, 50, 45])), 'usually 45 min-2.5 h');
});

test('the title counts what is in flight', () => {
  assert.equal(titleWithCount('BunkerCoin wallet', 0), 'BunkerCoin wallet');
  assert.equal(titleWithCount('BunkerCoin wallet', 1), '(1) BunkerCoin wallet');
});

test('lock-screen summary names in-flight transfers and their totals', () => {
  assert.equal(inflightSummary([entry({ state: 'failed' })]), null);
  assert.equal(
    inflightSummary([entry({}), entry({ kind: 'faucet', amount: 1_000_000n, fee: undefined, to: undefined })]),
    '2 transfers in flight · 0.250100 BUNKER out · 1.000000 BUNKER in. Tracking continues while locked.',
  );
});

test('phases persist and rebuild from storage; settled entries keep theirs', async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  const a = entry({ txId: 'a', kind: 'token-send', tokenId: '01000000', amount: 3n });
  await mutatePending('c', 'w', addEntry(a));
  await mutatePending('c', 'w', phaseEntry('a', 'block'));
  const [back] = loadPending('c', 'w');
  assert.equal(back.phase, 'block');
  assert.equal(back.tokenId, '01000000');
  assert.deepEqual(spendableTokens([{ tokenId: '01000000', ticker: null, balance: 10n, metadataHash: null }] as never, [back])[0].balance, 7n);
  const failed = phaseEntry('a', 'mempool')([{ ...back, state: 'failed' }]);
  assert.equal(failed[0].phase, 'block');
});
