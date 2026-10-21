import { test, expect, PASSWORD } from '../harness/fixtures';
import { FEE_UNITS, FINALITY_MS, UNITS_PER_BUNKER } from '../harness/rpc';
import { shortValue } from '../pages/wallet';

test('send BUNKER: sender pays amount + fee, receiver gets amount', async ({ openWallet, rpc }) => {
  const sender = await openWallet();
  const receiver = await openWallet();
  const { address: from } = await sender.createWallet(PASSWORD);
  const { address: to } = await receiver.createWallet(PASSWORD);

  await rpc.fund(from, UNITS_PER_BUNKER);
  await sender.expectBalance(UNITS_PER_BUNKER);

  const amount = 250_000;
  await sender.send(to, '0.25');
  await expect(sender.pendingRow(/^Send 0\.25 → /)).toContainText('confirming…');

  const senderAfter = UNITS_PER_BUNKER - amount - FEE_UNITS;
  await expect.poll(() => rpc.getBalance(from), { timeout: FINALITY_MS }).toBe(senderAfter);
  expect(await rpc.getBalance(to)).toBe(amount);
  await sender.expectBalance(senderAfter);
  await receiver.expectBalance(amount);

  const sent = sender.historyRow('Sent', '0.25 BUNKER');
  await sender.expectFinalized(sent);
  const details = await sender.txDetails(sent);
  expect(details).toMatchObject({
    From: shortValue(from),
    To: shortValue(to),
    Amount: '0.25 BUNKER',
    Fee: '0.0001 BUNKER',
  });
  expect(details.Reference).toMatch(/…/);

  await receiver.expectFinalized(receiver.historyRow('Received', '0.25 BUNKER'), 60_000);
});

test('send BUNKER: amount above balance is refused before signing', async ({ openWallet }) => {
  const sender = await openWallet();
  const receiver = await openWallet();
  await sender.createWallet(PASSWORD);
  const { address: to } = await receiver.createWallet(PASSWORD);
  await sender.expectBalance(0, 60_000);

  await sender.send(to, '1');
  await expect(sender.card('Send').getByText(/^Insufficient balance/)).toBeVisible();
  await expect(sender.card('Activity')).toHaveCount(0);
});
