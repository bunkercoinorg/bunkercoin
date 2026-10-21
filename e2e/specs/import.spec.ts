import { test, expect, PASSWORD } from '../harness/fixtures';
import { UNITS_PER_BUNKER } from '../harness/rpc';

test('import from phrase in a fresh context restores address and balance', async ({ openWallet, rpc }) => {
  const original = await openWallet();
  const { phrase, address } = await original.createWallet(PASSWORD);
  await rpc.fund(address, UNITS_PER_BUNKER);

  const restored = await openWallet();
  await expect(restored.onboarding).toBeVisible();
  expect(await restored.recover(phrase, 'another password 42')).toBe(address);
  await restored.expectBalance(UNITS_PER_BUNKER, 60_000);
  expect(await rpc.getBalance(address)).toBe(UNITS_PER_BUNKER);
});

test('import rejects a phrase with a bad checksum', async ({ openWallet }) => {
  const wallet = await openWallet();
  await wallet.button('Recover existing').click();
  const card = wallet.card('Recover a wallet');
  await card.getByRole('textbox').fill(Array(24).fill('abandon').join(' '));
  await wallet.button('Continue', card).click();
  await expect(card.getByText(/not a valid recovery phrase/)).toBeVisible();
});
