import { expect, type Locator, type Page } from '@playwright/test';
import { formatBunker } from '../harness/rpc';
import { LIVE_EXPLORER_URL } from '../harness/target';
import { escape, facts } from './wallet';

const LOAD_MS = 60_000;

export class ExplorerPage {
  constructor(readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole('main');
  }

  heading(name: string): Locator {
    return this.page.getByRole('heading', { name, exact: true, level: 1 });
  }

  /** The tag beside the page's h1 (`finalized`, `confirmed`, ...). */
  get statusTag(): Locator {
    return this.main.locator('.bc-tag').first();
  }

  async openTx(id: string): Promise<void> {
    await this.page.goto(`${LIVE_EXPLORER_URL}/tx?sig=${encodeURIComponent(id)}`);
    await expect(this.heading('Transaction.')).toBeVisible({ timeout: LOAD_MS });
    await expect(this.main.locator(`button[title="copy ${id}"]`)).toBeAttached();
  }

  /** Key facts plus the `details` disclosure (execution, fee, nonce, slot). */
  async txFacts(): Promise<Record<string, string>> {
    return facts(this.main);
  }

  /** The account view does not poll; reload until the indexer reports the expected balance. */
  async expectAccountBalance(address: string, units: number, timeout: number): Promise<void> {
    const balance = this.main.locator('.bc-bal');
    const text = new RegExp(`^${escape(formatBunker(units))}\\s*BUNKER$`);
    await expect(async () => {
      await this.page.goto(`${LIVE_EXPLORER_URL}/account?address=${encodeURIComponent(address)}`);
      await expect(this.heading('Account.')).toBeVisible({ timeout: LOAD_MS });
      await expect(balance).toHaveText(text, { timeout: 10_000 });
    }).toPass({ timeout, intervals: [15_000] });
  }
}
