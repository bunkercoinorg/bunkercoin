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
  await wallet.button(/^import a wallet/).click();
  await wallet.page.getByLabel('recovery phrase', { exact: true }).fill(Array(24).fill('abandon').join(' '));
  await expect(wallet.page.getByText('Checksum failed. Check the word order.', { exact: true })).toBeVisible();
  await wallet.button('continue').click();
  await expect(wallet.main.getByRole('alert')).toHaveText('Checksum failed. Check the word order.');
  await expect(wallet.heading('Enter your 24 words.')).toBeVisible();
  await expect(wallet.heading('Set a password.')).toHaveCount(0);
});
