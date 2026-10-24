import { test, expect, live, PASSWORD } from '../harness/fixtures';
import { FINALITY_MS, UNITS_PER_BUNKER } from '../harness/rpc';
import { IN_FLIGHT } from '../pages/wallet';

test('faucet: airdrop lands as exactly 1 BUNKER after finality', live, async ({ openWallet, rpc }) => {
  const wallet = await openWallet();
  const { address } = await wallet.createWallet(PASSWORD);
  await wallet.expectBalance(0, 60_000);

  await rpc.settleAirdrops();
  await wallet.requestFaucet();
  await expect(wallet.activityRow('faucet', '+1.000000')).toContainText(IN_FLIGHT);

  await wallet.expectBalance(UNITS_PER_BUNKER);
  await expect.poll(() => rpc.getBalance(address), { timeout: FINALITY_MS }).toBe(UNITS_PER_BUNKER);

  await wallet.expectFinalized(wallet.activityRow('receive', '+1.000000'));
  await expect(wallet.activityRow('faucet')).toHaveCount(0);
});
