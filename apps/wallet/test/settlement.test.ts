import test from 'node:test';
import assert from 'node:assert/strict';
import type { SignatureStatus, TokenBalance } from '../src/lib/connection.ts';
import {
  dropReflected,
  fetchSnapshot,
  isInflight,
  mergeStored,
  nativeSpendable,
  revalidate,
  spendableTokens,
} from '../src/lib/inflight.ts';
import { addEntry, finalizeEntry, loadPending, mutatePending, type PendingTx } from '../src/lib/pending.ts';

const TO = '8Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx';
const OTHER = '9Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx';
const FINAL: SignatureStatus = { confirmationStatus: 'finalized', err: null };
const PROCESSED: SignatureStatus = { confirmationStatus: 'processed', err: null };

const entry = (p: Partial<PendingTx>): PendingTx => ({
  txId: 'a',
  kind: 'send',
  amount: 250n,
  at: 0,
  nonce: 0n,
  state: 'pending',
  fee: 10n,
  to: TO,
  ...p,
});

const token = (tokenId: string, balance: bigint) => ({ tokenId, ticker: null, balance, metadataHash: null }) as unknown as TokenBalance;

test('a finalized entry keeps holding funds until a balance fetched after it is committed', () => {
  const [a] = finalizeEntry(['a'], 100)([entry({})]);
  assert.equal(isInflight(a), false);
  assert.equal(nativeSpendable(1000n, [a]).available, 740n);
  assert.equal(spendableTokens([token('01', 9n)], [{ ...a, kind: 'token-send', tokenId: '01', amount: 4n }])[0].balance, 5n);
  assert.deepEqual(dropReflected(100)([a]), [a]);
  assert.deepEqual(dropReflected(101)([a]), []);
  assert.equal(finalizeEntry(['a'], 200)([a])[0].finalizedAt, 100);
  assert.equal(finalizeEntry(['a'], 200)([{ ...entry({}), state: 'failed' }])[0].finalizedAt, undefined);
});

test('finalizedAt survives storage', async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  });
  await mutatePending('c', 'w', addEntry(entry({})));
  await mutatePending('c', 'w', finalizeEntry(['a'], 42));
  assert.equal(loadPending('c', 'w')[0].finalizedAt, 42);
});

function harness(statusSeq: (SignatureStatus | null)[][], balances: bigint[], during?: (list: PendingTx[], at: number) => PendingTx[]) {
  let clock = 0;
  let list = [entry({})];
  const marks: [string[], number][] = [];
  let fetches = 0;
  return {
    marks,
    fetches: () => fetches,
    deps: {
      now: () => ++clock,
      fetch: async () => {
        if (during && fetches === 0) list = during(list, ++clock);
        return balances[fetches++];
      },
      entries: () => list,
      statuses: async () => statusSeq.shift() ?? [PROCESSED],
      finalize: (ids: string[], at: number) => {
        marks.push([ids, at]);
        list = finalizeEntry(ids, at)(list);
      },
    },
  };
}

test('a snapshot with nothing settling commits on the first fetch', async () => {
  const h = harness([[PROCESSED]], [1000n]);
  const snap = await fetchSnapshot(h.deps);
  assert.deepEqual(snap, { value: 1000n, at: 1 });
  assert.equal(h.marks.length, 0);
});

test('a snapshot spanning finality is marked, refetched, and then drops the entry without double-subtracting', async () => {
  // The first balance may already include the debit while the entry is still open; it is never committed.
  const h = harness([[FINAL]], [740n, 740n]);
  const snap = await fetchSnapshot(h.deps);
  assert.equal(h.fetches(), 2);
  assert.equal(h.marks.length, 1);
  const [[ids, finalAt]] = h.marks;
  assert.deepEqual(ids, ['a']);
  assert.ok(snap && snap.at > finalAt);
  const list = finalizeEntry(ids, finalAt)([entry({})]);
  assert.equal(nativeSpendable(1000n, list).available, 740n);
  const after = dropReflected(snap!.at)(list);
  assert.equal(nativeSpendable(snap!.value, after).available, 740n);
});

test('a tracker seeing finality while the fetch runs also forces a refetch', async () => {
  const h = harness([], [740n, 740n], (list, at) => finalizeEntry(['a'], at)(list));
  const snap = await fetchSnapshot(h.deps);
  assert.equal(h.fetches(), 2);
  assert.equal(h.marks.length, 0);
  assert.deepEqual(dropReflected(snap!.at)(h.deps.entries()), []);
});

test('a snapshot that keeps spanning finality is not committed', async () => {
  let clock = 0;
  let n = 0;
  const snap = await fetchSnapshot({
    now: () => ++clock,
    fetch: async () => 1n,
    entries: () => [entry({ txId: `t${n}` })],
    statuses: async () => [FINAL],
    finalize: () => n++,
    tries: 3,
  });
  assert.equal(snap, null);
  assert.equal(n, 3);
});

test("rebuild from storage: another tab's sends appear, its removals keep holding until this tab reconciles", () => {
  const mine = entry({ txId: 'mine' });
  const unsaved = entry({ txId: 'new' });
  const theirs = entry({ txId: 'theirs', amount: 5n });
  const failed = entry({ txId: 'f', state: 'failed' });
  const persisted = new Set(['mine', 'f', 'theirs']);
  const merged = mergeStored([theirs], [mine, unsaved, failed], persisted, 0, 50);
  assert.deepEqual(
    merged.map((p) => [p.txId, p.finalizedAt]),
    [
      ['theirs', undefined],
      ['mine', 50],
      ['new', undefined],
    ],
  );
  assert.equal(nativeSpendable(1000n, merged).available, 1000n - 5n - 10n - 250n - 10n - 250n - 10n);
  assert.deepEqual(mergeStored([], [{ ...mine, finalizedAt: 50 }], persisted, 51, 60), []);
  const seen = mergeStored([mine], [{ ...mine, finalizedAt: 7 }], persisted, 0, 60);
  assert.equal(seen[0].finalizedAt, 7);
});

test('revalidation under the lock catches funds and duplicates another tab used since review', () => {
  const info = { kind: 'send' as const, to: TO, amount: 500n, fee: 10n };
  assert.equal(revalidate(info, 1000n, [], [], null), '');
  const other = entry({ txId: 'x', to: OTHER, amount: 600n });
  assert.match(revalidate(info, 1000n, [], [other], null), /spent these funds/);
  const same = entry({ txId: 'd', amount: 500n });
  assert.match(revalidate(info, 2000n, [], [same], null), /matching send/);
  assert.equal(revalidate(info, 2000n, [], [same], 'd'), '');
  assert.match(revalidate(info, 2000n, [], [same, { ...same, txId: 'e' }], 'e'), /matching send/);
  const tokenInfo = { kind: 'token-send' as const, to: TO, amount: 6n, tokenId: '01', fee: 10n };
  const tokenOut = entry({ txId: 't', kind: 'token-send', tokenId: '01', amount: 5n, to: OTHER });
  assert.equal(revalidate(tokenInfo, 100n, [token('01', 10n)], [], null), '');
  assert.match(revalidate(tokenInfo, 100n, [token('01', 10n)], [tokenOut], null), /spent these funds/);
  assert.match(revalidate({ kind: 'mint', amount: 1n, fee: 10n }, 5n, [], [], null), /spent these funds/);
  assert.equal(revalidate(info, null, [], [], null), '');
});
