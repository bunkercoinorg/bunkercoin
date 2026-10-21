import { test, expect, PASSWORD, uniqueTicker } from '../harness/fixtures';
import { FEE_UNITS, FINALITY_MS, UNITS_PER_BUNKER } from '../harness/rpc';

test('create token, then send it: only the token moves, BUNKER pays fees', async ({ openWallet, rpc }) => {
  const issuer = await openWallet();
  const holder = await openWallet();
  const { address: from } = await issuer.createWallet(PASSWORD);
  const { address: to } = await holder.createWallet(PASSWORD);
  await rpc.fund(from, UNITS_PER_BUNKER);
  await issuer.expectBalance(UNITS_PER_BUNKER);

  const ticker = uniqueTicker();
  await issuer.createToken(ticker, 1000);
  await expect(issuer.pendingRow(`Create ${ticker} · 1,000 supply`)).toContainText('confirming…');
  await expect.poll(() => rpc.tokenAmount(from, ticker), { timeout: FINALITY_MS }).toBe(1000);
  await expect(issuer.tokenBalance(ticker)).toHaveText('1,000', { timeout: FINALITY_MS });
  await issuer.expectBalance(UNITS_PER_BUNKER - FEE_UNITS);

  await issuer.send(to, '100', ticker);
  await expect(issuer.pendingRow(`Send 100 ${ticker} → `)).toContainText('confirming…');

  await expect.poll(() => rpc.tokenAmount(to, ticker), { timeout: FINALITY_MS }).toBe(100);
  expect(await rpc.tokenAmount(from, ticker)).toBe(900);
  expect(await rpc.getBalance(from)).toBe(UNITS_PER_BUNKER - 2 * FEE_UNITS);
  expect(await rpc.getBalance(to)).toBe(0);

  await expect(issuer.tokenBalance(ticker)).toHaveText('900', { timeout: FINALITY_MS });
  await issuer.expectBalance(UNITS_PER_BUNKER - 2 * FEE_UNITS);
  await expect(holder.tokenBalance(ticker)).toHaveText('100', { timeout: FINALITY_MS });
  await holder.expectBalance(0);
  await issuer.expectFinalized(issuer.historyRow('Sent', '100 tokens'));
});

// Activity renders a finalized Mint as "↑ Sent 0 to <own address>": HistoryRow only knows Transfer/TokenTransfer.
test.fixme('activity labels a token creation as a mint, not a 0 BUNKER send', async ({ openWallet, rpc }) => {
  const issuer = await openWallet();
  const { address } = await issuer.createWallet(PASSWORD);
  await rpc.fund(address, UNITS_PER_BUNKER);
  await issuer.expectBalance(UNITS_PER_BUNKER);
  const ticker = uniqueTicker();
  await issuer.createToken(ticker, 10);
  await expect.poll(() => rpc.tokenAmount(address, ticker), { timeout: FINALITY_MS }).toBe(10);
  await expect(issuer.pendingRow(`Create ${ticker} · 10 supply`)).toHaveCount(0, { timeout: FINALITY_MS });
  await expect(issuer.historyRow('Sent', '0')).toHaveCount(0);
  await expect(issuer.card('Activity').getByText(ticker)).toBeVisible();
});
