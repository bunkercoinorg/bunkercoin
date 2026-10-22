import test from 'node:test';
import assert from 'node:assert/strict';
import type { TokenBalance } from '../src/lib/connection.ts';
import { parseAmount } from '../src/lib/format.ts';
import { addressToHex, sameAddress } from '../src/lib/keys.ts';
import { amountProblem, heldOf, NATIVE_SEND, pickAsset, sendProblem, TOKEN_GONE, tokenIdentity } from '../src/lib/send.ts';

const ADDR = '8Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx';
const token = (over: Partial<TokenBalance> = {}): TokenBalance => ({
  tokenId: '05000000',
  ticker: 'BUNKER',
  balance: 10n,
  metadataHash: null,
  creator: null,
  ...over,
});
const FEE = 5_000n;

test('a picked token stays a token send after it leaves the wallet', () => {
  const asset = pickAsset([token()], '05000000');
  assert.equal(asset?.kind, 'token');
  assert.equal(asset?.unit, 'BUNKER · 05000000');
  assert.equal(heldOf(asset!, 1_000_000n, []), 'gone');
  assert.equal(sendProblem(asset!, 10n, FEE, 1_000_000n, []), TOKEN_GONE);
  assert.deepEqual(amountProblem(asset!, '10', FEE, 1_000_000n, []), [TOKEN_GONE, 10n]);
  assert.equal(asset?.kind, 'token');
});

test('a token that is not held cannot be picked, native always can', () => {
  assert.equal(pickAsset([], '05000000'), null);
  assert.equal(pickAsset([], null), NATIVE_SEND);
});

test('a token ticked BUNKER never reads as the native coin', () => {
  assert.equal(tokenIdentity({ tokenId: '05000000', ticker: 'BUNKER' }), 'BUNKER · 05000000');
  assert.equal(tokenIdentity({ tokenId: '05000000', ticker: null }), 'token 05000000');
  assert.notEqual(pickAsset([token()], '05000000')?.unit, NATIVE_SEND.unit);
});

test('send checks use live balances against the frozen asset', () => {
  const asset = pickAsset([token()], '05000000')!;
  assert.equal(sendProblem(asset, 11n, FEE, 1_000_000n, [token()]), 'Amount exceeds balance.');
  assert.match(sendProblem(asset, 1n, FEE, 1_000n, [token()]), /pay the fee in BUNKER/);
  assert.equal(sendProblem(asset, 10n, FEE, 1_000_000n, [token()]), '');
  assert.match(sendProblem(NATIVE_SEND, 999_000n, FEE, 1_000_000n, []), /Not enough BUNKER for the 0.005000 fee/);
});

test('grouped token amounts parse, BUNKER decimals are never stripped', () => {
  assert.equal(parseAmount('1,000,000', 0), 1_000_000n);
  assert.equal(parseAmount('1 000 000', 0), 1_000_000n);
  assert.throws(() => parseAmount('1.5', 0), /Tokens use whole units\./);
  assert.throws(() => parseAmount('0,5', 6), /Enter an amount above 0\./);
  assert.equal(parseAmount('0.5', 6), 500_000n);
  const asset = pickAsset([token({ balance: 2_000_000n })], '05000000')!;
  assert.deepEqual(amountProblem(asset, '1,000,000', FEE, 1_000_000n, [token({ balance: 2_000_000n })]), ['', 1_000_000n]);
  assert.deepEqual(amountProblem(asset, 'abc', FEE, 1_000_000n, []), ['Enter an amount above 0.', 0n]);
});

test('self-send compares decoded bytes, not the typed string', () => {
  const hex = addressToHex(ADDR);
  assert.ok(sameAddress(hex, ADDR));
  assert.ok(sameAddress(hex.toUpperCase(), ADDR));
  assert.ok(sameAddress(` ${ADDR} `, ADDR));
  assert.ok(!sameAddress(`00${hex.slice(2)}`, ADDR));
  assert.ok(!sameAddress('nonsense', ADDR));
});
