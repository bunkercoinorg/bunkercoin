import { test, expect, PASSWORD } from '../harness/fixtures';
import { FEE_UNITS, FINALITY_MS, UNITS_PER_BUNKER } from '../harness/rpc';
import { IN_FLIGHT } from '../pages/wallet';

test('send BUNKER: sender pays amount + fee, receiver gets amount', async ({ openWallet, rpc }) => {
  const sender = await openWallet();
  const receiver = await openWallet();
  const { address: from } = await sender.createWallet(PASSWORD);
  const { address: to } = await receiver.createWallet(PASSWORD);

  await rpc.fund(from, UNITS_PER_BUNKER);
  await sender.expectBalance(UNITS_PER_BUNKER);

  const amount = 250_000;
  await sender.prepareSend(to, '0.25');
  expect(await sender.receiptFacts()).toMatchObject({
    to,
    amount: '0.250000 BUNKER',
    'network fee': expect.stringMatching(/^0\.000100 BUNKER · \d{2}:\d{2}:\d{2} UTC$/),
    total: '0.250100 BUNKER',
    from,
    nonce: '0',
  });
  await sender.sign();
  await sender.expectSent('0.250000 BUNKER');
  await sender.done();
  await expect(sender.activityRow('send', '−0.250000')).toContainText(IN_FLIGHT);

  const senderAfter = UNITS_PER_BUNKER - amount - FEE_UNITS;
  await expect.poll(() => rpc.getBalance(from), { timeout: FINALITY_MS }).toBe(senderAfter);
  expect(await rpc.getBalance(to)).toBe(amount);
  await sender.expectBalance(senderAfter);
  await receiver.expectBalance(amount);

  const sent = sender.activityRow('send', '−0.250000');
  await sender.expectFinalized(sent);
  const details = await sender.txDetails(sent);
  expect(details).toMatchObject({
    to,
    fee: '0.000100 BUNKER',
    amount: '−0.250000BUNKER',
    nonce: '0',
    execution: 'succeeded',
  });
  expect(details.transaction).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,88}$/);

  await receiver.expectFinalized(receiver.activityRow('receive', '+0.250000'), 60_000);
  expect((await receiver.txDetails(receiver.activityRow('receive', '+0.250000'))).from).toBe(from);
});

test('send BUNKER: amount above balance is refused before signing', async ({ openWallet }) => {
  const sender = await openWallet();
  const receiver = await openWallet();
  await sender.createWallet(PASSWORD);
  const { address: to } = await receiver.createWallet(PASSWORD);
  await sender.expectBalance(0, 60_000);
  await expect(sender.tile('send')).toBeDisabled();

  // The tile is off at a zero balance; the send route itself must still refuse.
  await sender.page.evaluate(() => (window.location.hash = '#send'));
  await sender.page.getByLabel('to', { exact: true }).fill(to);
  await sender.button('next').click();
  await sender.page.getByLabel('amount', { exact: true }).fill('1');
  await sender.button('review').click();
  await expect(sender.amountAlert).toHaveText('Amount exceeds balance.');
  await expect(sender.receipt).toHaveCount(0);
  await sender.goHome();
  await expect(sender.main.getByText('No activity yet.', { exact: true })).toBeVisible();
});
