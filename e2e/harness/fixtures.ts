import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { WalletPage } from '../pages/wallet';
import { Rpc } from './rpc';
import { LIVE } from './target';

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
  /** Console errors, page errors, failed and >= 400 requests from every page the test opened. */
  diagnostics: (page: Page) => void;
}

/** Specs that also run against the live testnet (`E2E_TARGET=live`): no fault injection, one airdrop per funded wallet. */
export const live = { tag: '@live' };

export const test = base.extend<Fixtures>({
  baseURL: async ({}, use) => use(env('E2E_WALLET_URL')),
  rpcUrl: async ({}, use) => use(env('E2E_RPC_URL')),
  rpc: async ({ rpcUrl }, use) => use(new Rpc(rpcUrl)),
  diagnostics: async ({}, use, testInfo) => {
    const seen: string[] = [];
    await use((page) => {
      const at = () => new URL(page.url()).host || page.url();
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') seen.push(`[${at()}] console.${m.type()}: ${m.text()}`);
      });
      page.on('pageerror', (e) => seen.push(`[${at()}] pageerror: ${e.message}`));
      page.on('requestfailed', (r) => seen.push(`[${at()}] requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
      page.on('response', async (r) => {
        if (r.status() < 400) return;
        const body = r.request().postData()?.slice(0, 200) ?? '';
        seen.push(`[${at()}] http ${r.status()}: ${r.request().method()} ${r.url()} ${body}`);
      });
    });
    if (seen.length === 0) return;
    await testInfo.attach('browser-diagnostics', { body: seen.join('\n'), contentType: 'text/plain' });
    if (LIVE) console.log(`browser diagnostics (${testInfo.title}):\n  ${seen.join('\n  ')}`);
  },
  openWallet: async ({ browser, baseURL, diagnostics }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({ baseURL, permissions: ['clipboard-read', 'clipboard-write'] });
      contexts.push(context);
      const page = await context.newPage();
      diagnostics(page);
      const wallet = new WalletPage(page);
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
