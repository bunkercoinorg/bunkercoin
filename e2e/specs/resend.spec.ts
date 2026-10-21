import type { BrowserContext, Route } from '@playwright/test';
import { test, expect, PASSWORD } from '../harness/fixtures';
import { FEE_UNITS, FINALITY_MS, UNITS_PER_BUNKER, type Rpc } from '../harness/rpc';
import type { WalletPage } from '../pages/wallet';

type Fault = 'drop-reply' | 'drop-request';

/**
 * Records the signed bytes of every sendTransaction the page makes. The first one is faulted:
 * 'drop-reply' lets it reach the node and loses the answer, 'drop-request' never forwards it.
 */
async function faultFirstBroadcast(context: BrowserContext, rpcUrl: string, fault: Fault): Promise<string[]> {
  const wires: string[] = [];
  await context.route(`${rpcUrl}**`, async (route: Route) => {
    const request = route.request();
    const body = request.method() === 'POST' ? (request.postDataJSON() as { method?: string; params?: string[] }) : null;
    if (body?.method !== 'sendTransaction') return route.fallback();
    wires.push(body.params![0]);
    if (wires.length > 1) return route.fallback();
    if (fault === 'drop-reply') await route.fetch();
    await route.abort('connectionreset');
  });
  return wires;
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

test('lost acknowledgement: retrying Send signs nothing new and the sender is debited once', async ({
  openWallet,
  rpc,
  rpcUrl,
}) => {
  const { sender, from, to } = await fundedPair(openWallet, rpc);
  const wires = await faultFirstBroadcast(sender.page.context(), rpcUrl, 'drop-reply');

  await sender.send(to, '0.25');
  await expect(sender.sendError).toContainText('No answer from the node');
  const row = sender.pendingRow(/^Send 0\.25 → /);
  await expect(row).toBeVisible();

  // The form keeps its values after the error: this is the user pressing Send again.
  await sender.button('Send', sender.card('Send')).click();
  await expect(sender.sendError).toContainText('reached the network without an acknowledgement. Sending is paused');
  await expect(row).toContainText('confirming…');
  await expect(sender.resendButton(row)).toHaveCount(0);
  expect(wires).toHaveLength(1);

  await expect.poll(() => rpc.getBalance(from), { timeout: FINALITY_MS }).toBe(SENDER_AFTER);
  expect(await rpc.getBalance(to)).toBe(AMOUNT);
  expect(await rpc.getNonce(from)).toBe(1);
  await sender.expectFinalized(sender.historyRow('Sent', '0.25 BUNKER'));
  await sender.expectBalance(SENDER_AFTER);
  expect(wires).toHaveLength(1);

  // Settled: sending resumes with the next nonce.
  await sender.send(to, '0.1');
  await expect(sender.pendingRow(/^Send 0\.1 → /)).toContainText('confirming…');
  expect(wires).toHaveLength(2);
  expect(wires[1]).not.toBe(wires[0]);
});

test('lost request: Resend broadcasts the identical bytes and the sender is debited once', async ({
  openWallet,
  rpc,
  rpcUrl,
}) => {
  const { sender, from, to } = await fundedPair(openWallet, rpc);
  const wires = await faultFirstBroadcast(sender.page.context(), rpcUrl, 'drop-request');

  await sender.send(to, '0.25');
  await expect(sender.sendError).toContainText('No answer from the node');
  const row = sender.pendingRow(/^Send 0\.25 → /);
  await expect(row).toContainText('no answer from node');
  // Unseen by the node, the row keeps offering Resend across tracker polls.
  await sender.page.waitForTimeout(12_000);
  await expect(row).toContainText('no answer from node');

  await sender.resendButton(row).click();
  await expect(row).toContainText('confirming…');
  expect(wires).toHaveLength(2);
  expect(wires[1]).toBe(wires[0]);

  await expect.poll(() => rpc.getBalance(from), { timeout: FINALITY_MS }).toBe(SENDER_AFTER);
  expect(await rpc.getBalance(to)).toBe(AMOUNT);
  expect(await rpc.getNonce(from)).toBe(1);
  await sender.expectFinalized(sender.historyRow('Sent', '0.25 BUNKER'));
  expect(wires).toHaveLength(2);
});
