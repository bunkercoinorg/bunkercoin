import { test, expect, live, PASSWORD, uniqueTicker } from '../harness/fixtures';
import { FEE_UNITS, FINALITY_MS, UNITS_PER_BUNKER } from '../harness/rpc';
import { IN_FLIGHT } from '../pages/wallet';

test('create token, then send it: only the token moves, BUNKER pays fees', live, async ({ openWallet, rpc }) => {
  const issuer = await openWallet();
  const holder = await openWallet();
  const { address: from } = await issuer.createWallet(PASSWORD);
  const { address: to } = await holder.createWallet(PASSWORD);
  await rpc.fund(from, UNITS_PER_BUNKER);
  await issuer.expectBalance(UNITS_PER_BUNKER);

  const ticker = uniqueTicker();
  await issuer.createToken(ticker, 1000);
  await issuer.done();
  await expect(issuer.activityRow('create token', ticker, '1,000')).toContainText(IN_FLIGHT);
  await expect.poll(() => rpc.tokenAmount(from, ticker), { timeout: FINALITY_MS }).toBe(1000);
  await issuer.expectTokenBalance(ticker, '1,000');
  await issuer.expectBalance(UNITS_PER_BUNKER - FEE_UNITS);

  await issuer.prepareSend(to, '100', ticker);
  const identity = new RegExp(`^${ticker} · \\S+$`);
  const receipt = await issuer.receiptFacts();
  expect(receipt.token).toMatch(identity);
  expect(receipt).toMatchObject({
    to,
    amount: `100 ${receipt.token}`,
    'network fee': expect.stringMatching(/^0\.000100 BUNKER · /),
    from,
  });
  expect(receipt.total).toBeUndefined();
  await issuer.sign();
  await issuer.expectSent(`100 ${receipt.token}`);
  await issuer.done();
  await expect(issuer.activityRow('token send', `100 ${receipt.token} to `)).toContainText(IN_FLIGHT);

  await expect.poll(() => rpc.tokenAmount(to, ticker), { timeout: FINALITY_MS }).toBe(100);
  expect(await rpc.tokenAmount(from, ticker)).toBe(900);
  expect(await rpc.getBalance(from)).toBe(UNITS_PER_BUNKER - 2 * FEE_UNITS);
  expect(await rpc.getBalance(to)).toBe(0);

  await issuer.expectTokenBalance(ticker, '900');
  await issuer.expectBalance(UNITS_PER_BUNKER - 2 * FEE_UNITS);
  await holder.expectTokenBalance(ticker, '100');
  await holder.expectBalance(0);
  await issuer.expectFinalized(issuer.activityRow('token send', `100 ${ticker}`, '−100'));
});

test('activity labels a token creation as a mint, not a 0 BUNKER send', async ({ openWallet, rpc }) => {
  const issuer = await openWallet();
  const { address } = await issuer.createWallet(PASSWORD);
  await rpc.fund(address, UNITS_PER_BUNKER);
  await issuer.expectBalance(UNITS_PER_BUNKER);
  const ticker = uniqueTicker();
  await issuer.createToken(ticker, 10);
  await issuer.done();
  await expect.poll(() => rpc.tokenAmount(address, ticker), { timeout: FINALITY_MS }).toBe(10);
  const mint = issuer.activityRow('create token', ticker, '10');
  await issuer.expectFinalized(mint);
  await expect(mint).not.toContainText(IN_FLIGHT);
  await expect(issuer.activityRow('send')).toHaveCount(0);
  await expect(issuer.activityRow('token send')).toHaveCount(0);
});
