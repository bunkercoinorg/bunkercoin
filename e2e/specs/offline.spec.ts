import { test, expect, PASSWORD } from '../harness/fixtures';

test('offline: an unreachable node is not reported as live', async ({ openWallet, rpcUrl }) => {
  const wallet = await openWallet();
  await wallet.createWallet(PASSWORD);
  await expect(wallet.liveStatus).toBeVisible({ timeout: 60_000 });

  await wallet.page.context().route(`${rpcUrl}**`, (route) => route.abort('connectionrefused'));

  // Two balance polls (20 s each) is ample for the wallet to notice.
  await expect(wallet.connectionStatus).toHaveText(/^offline · updated (\d+s|\d+m \d+s) ago$/, { timeout: 60_000 });
  await expect(wallet.liveStatus).toHaveCount(0);

  await wallet.page.context().unroute(`${rpcUrl}**`);
  await expect(wallet.liveStatus).toBeVisible({ timeout: 60_000 });
});
