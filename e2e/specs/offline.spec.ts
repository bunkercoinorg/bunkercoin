import { test, expect, PASSWORD } from '../harness/fixtures';

test('offline: an unreachable node is not reported as live', async ({ openWallet, rpcUrl }) => {
  const wallet = await openWallet();
  await wallet.createWallet(PASSWORD);
  await expect(wallet.liveStatus).toBeVisible({ timeout: 60_000 });

  await wallet.page.context().route(`${rpcUrl}**`, (route) => route.abort('connectionrefused'));

  // Two balance polls (20 s each) is ample for the wallet to notice.
  const host = new URL(rpcUrl).host;
  await expect(wallet.offlineBanner).toContainText(
    new RegExp(`^Offline\\. Can't reach ${host.replace(/\./g, '\\.')}; values are from \\d{2}:\\d{2}:\\d{2} UTC\\.`),
    { timeout: 60_000 },
  );
  await expect(wallet.networkTag).toHaveText('offline');
  await expect(wallet.liveStatus).toHaveCount(0);
  await expect(wallet.tile('faucet')).toBeDisabled();
  await expect(wallet.tile('receive')).toBeEnabled();

  await wallet.page.context().unroute(`${rpcUrl}**`);
  await expect(wallet.liveStatus).toBeVisible({ timeout: 60_000 });
  await expect(wallet.offlineBanner).toHaveCount(0);
});
