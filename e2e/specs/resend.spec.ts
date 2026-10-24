import type { BrowserContext, Route } from '@playwright/test';
import { test, expect, PASSWORD } from '../harness/fixtures';
import { FEE_UNITS, FINALITY_MS, UNITS_PER_BUNKER, type Rpc } from '../harness/rpc';
import { IN_FLIGHT, type WalletPage } from '../pages/wallet';

type Fault = 'drop-reply' | 'drop-request';

const rpcMethod = (route: Route) => {
  const request = route.request();
  return request.method() === 'POST' ? (request.postDataJSON() as { method?: string; params?: string[] }) : null;
};

/**
 * Records the signed bytes of every sendTransaction the page makes. The first one is faulted:
 * 'drop-reply' lets it reach the node and loses the answer, 'drop-request' never forwards it.
 * Status lookups fail until `release()`, so the "no answer" state holds until the test lets the
 * wallet see what the node has.
 */
async function faultFirstBroadcast(context: BrowserContext, rpcUrl: string, fault: Fault) {
  const wires: string[] = [];
  let holding = true;
  await context.route(`${rpcUrl}**`, async (route: Route) => {
    const body = rpcMethod(route);
    if (holding && body?.method === 'getSignatureStatuses') return route.abort('connectionreset');
    if (body?.method !== 'sendTransaction') return route.fallback();
    wires.push(body.params![0]);
    if (wires.length > 1) return route.fallback();
    if (fault === 'drop-reply') await route.fetch();
    await route.abort('connectionreset');
  });
  return { wires, release: () => void (holding = false) };
}

async function fundedPair(openWallet: () => Promise<WalletPage>, rpc: Rpc) {
  const sender = await openWallet();
  const receiver = await openWallet();
  const { address: from } = await sender.createWallet(PASSWORD);
  const { address: to } = await receiver.createWallet(PASSWORD);
  await rpc.fund(from, UNITS_PER_BUNKER);
  await sender.expectBalance(UNITS_PER_BUNKER);
  return { sender, from, to };
}

const AMOUNT = 250_000;
const SENDER_AFTER = UNITS_PER_BUNKER - AMOUNT - FEE_UNITS;

async function expectOutcomeUnknown(sender: WalletPage) {
  await expect(sender.outcomeTitle).toHaveText('Send outcome unknown.');
  await expect(sender.main).toContainText("The node timed out after submission. Don't send again yet.");
  await expect(sender.signButton()).toHaveCount(0);
}

test('lost acknowledgement: retrying the send signs nothing new and the sender is debited once', async ({
  openWallet,
  rpc,
  rpcUrl,
}) => {
  const { sender, from, to } = await fundedPair(openWallet, rpc);
  const fault = await faultFirstBroadcast(sender.page.context(), rpcUrl, 'drop-reply');

  await sender.send(to, '0.25');
  await expectOutcomeUnknown(sender);
  expect(fault.wires).toHaveLength(1);

  // Once the node's status answers, the wallet sees it holds the transaction.
  fault.release();
  await sender.expectSent('0.250000 BUNKER', 30_000);
  await sender.done();
  const row = sender.activityRow('send', '−0.250000');
  await expect(row).toContainText(IN_FLIGHT);

  // The user sends the same again: review refuses to sign while the first may still execute.
  await sender.prepareSend(to, '0.25');
  await expect(sender.nonceBlock).toBeVisible();
  await expect(sender.signButton()).toBeDisabled();
  await sender.button('check status', sender.nonceBlock).click();
  await sender.page.waitForTimeout(3_000);
  await expect(sender.nonceBlock).toBeVisible();
  await expect(sender.signButton()).toBeDisabled();
  expect(fault.wires).toHaveLength(1);
  await sender.goHome();

  await expect.poll(() => rpc.getBalance(from), { timeout: FINALITY_MS }).toBe(SENDER_AFTER);
  expect(await rpc.getBalance(to)).toBe(AMOUNT);
  expect(await rpc.getNonce(from)).toBe(1);
  await sender.expectFinalized(row);
  await sender.expectBalance(SENDER_AFTER);
  expect(fault.wires).toHaveLength(1);

  // Settled: sending resumes with the next nonce.
  await sender.prepareSend(to, '0.1');
  expect((await sender.receiptFacts()).nonce).toBe('1');
  await sender.sign();
  await sender.expectSent('0.100000 BUNKER');
  expect(fault.wires).toHaveLength(2);
  expect(fault.wires[1]).not.toBe(fault.wires[0]);
});

test('lost request: check status broadcasts the identical bytes and the sender is debited once', async ({
  openWallet,
  rpc,
  rpcUrl,
}) => {
  const { sender, from, to } = await fundedPair(openWallet, rpc);
  const fault = await faultFirstBroadcast(sender.page.context(), rpcUrl, 'drop-request');
  fault.release();

  await sender.send(to, '0.25');
  await expectOutcomeUnknown(sender);
  await sender.done();
  const row = sender.activityRow('send', '−0.250000');
  await expect(row).toContainText('outcome unknown');
  // Unseen by the node, the row stays unknown across tracker polls.
  await sender.page.waitForTimeout(12_000);
  await expect(row).toContainText('outcome unknown');
  expect(fault.wires).toHaveLength(1);

  await sender.openTx(row);
  await sender.button('check status', sender.main).click();
  await expect(sender.main).toContainText(IN_FLIGHT);
  expect(fault.wires).toHaveLength(2);
  expect(fault.wires[1]).toBe(fault.wires[0]);
  await sender.goHome();

  await expect.poll(() => rpc.getBalance(from), { timeout: FINALITY_MS }).toBe(SENDER_AFTER);
  expect(await rpc.getBalance(to)).toBe(AMOUNT);
  expect(await rpc.getNonce(from)).toBe(1);
  await sender.expectFinalized(row);
  expect(fault.wires).toHaveLength(2);
});
