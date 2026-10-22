import { test as base, expect, type BrowserContext } from '@playwright/test';
import { WalletPage } from '../pages/wallet';
import { Rpc } from './rpc';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} unset: run through playwright.config.ts so global setup starts the stack`);
  return value;
}

interface Fixtures {
  rpc: Rpc;
  rpcUrl: string;
  /** A wallet in its own browser context: separate localStorage, sessionStorage and IndexedDB. */
  openWallet: () => Promise<WalletPage>;
}

export const test = base.extend<Fixtures>({
  baseURL: async ({}, use) => use(env('E2E_WALLET_URL')),
  rpcUrl: async ({}, use) => use(env('E2E_RPC_URL')),
  rpc: async ({ rpcUrl }, use) => use(new Rpc(rpcUrl)),
  openWallet: async ({ browser, baseURL }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({ baseURL, permissions: ['clipboard-read', 'clipboard-write'] });
      contexts.push(context);
      const wallet = new WalletPage(await context.newPage());
      await wallet.goto();
      return wallet;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export { expect };

export const PASSWORD = 'correct horse battery';

export function uniqueTicker(): string {
  return `E${Date.now().toString(36).slice(-5).toUpperCase()}`;
}
