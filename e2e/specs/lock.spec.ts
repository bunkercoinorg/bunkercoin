import { test, expect, live, PASSWORD } from '../harness/fixtures';
import { WalletPage } from '../pages/wallet';

test('lock and unlock: wrong password rejected, right one unlocks', live, async ({ openWallet }) => {
  const wallet = await openWallet();
  const { address } = await wallet.createWallet(PASSWORD);

  await wallet.lock();
  await expect(wallet.lockButton).toHaveCount(0);

  await wallet.submitUnlock('not the password');
  await expect(wallet.passwordError).toBeVisible({ timeout: 90_000 });
  await expect(wallet.unlockScreen).toBeVisible();

  await wallet.unlock(PASSWORD);
  expect(await wallet.address()).toBe(address);
});

test('session: reload resumes an unlocked tab, a locked or new tab needs the password', live, async ({ openWallet }) => {
  const wallet = await openWallet();
  const { address } = await wallet.createWallet(PASSWORD);

  await wallet.page.reload();
  await expect(wallet.lockButton).toBeVisible();
  expect(await wallet.address()).toBe(address);

  // sessionStorage is per tab: a second tab on the same profile starts locked.
  const tab = await wallet.page.context().newPage();
  await tab.goto('/');
  await expect(new WalletPage(tab).unlockScreen).toBeVisible();
  await tab.close();

  await wallet.lock();
  await wallet.page.reload();
  await expect(wallet.unlockScreen).toBeVisible();
  await wallet.unlock(PASSWORD);
  expect(await wallet.address()).toBe(address);
});
