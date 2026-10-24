import { test, expect, live, PASSWORD } from '../harness/fixtures';

test('erase wallet from settings returns to onboarding with no keystore', live, async ({ openWallet }) => {
  const wallet = await openWallet();
  await wallet.createWallet(PASSWORD);
  expect(await wallet.storedKeystore()).not.toBeNull();

  await wallet.eraseWallet();
  expect(await wallet.storedKeystore()).toBeNull();

  await wallet.page.reload();
  await expect(wallet.onboarding).toBeVisible();
  expect(await wallet.storedKeystore()).toBeNull();
});
