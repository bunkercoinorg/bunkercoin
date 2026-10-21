import { test, expect, PASSWORD } from '../harness/fixtures';

// Dashboard.refresh swallows RPC errors and keeps the last slot, so the indicator stays 'live' forever.
test.fixme('offline: an unreachable node is not reported as live', async ({ openWallet, rpcUrl }) => {
  const wallet = await openWallet();
  await wallet.createWallet(PASSWORD);
  await expect(wallet.liveStatus).toBeVisible({ timeout: 60_000 });

  await wallet.page.context().route(`${rpcUrl}**`, (route) => route.abort('connectionrefused'));

  // Two balance polls (20 s each) is ample for the wallet to notice.
  await expect(wallet.liveStatus).toBeHidden({ timeout: 60_000 });
});
