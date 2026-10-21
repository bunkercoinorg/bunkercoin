import { expect, type Locator, type Page } from '@playwright/test';
import { FINALITY_MS, formatBunker } from '../harness/rpc';

/**
 * Every wallet selector lives here so a UI redesign touches one file.
 * Roles, labels and visible text only; the few structural hops are marked
 * where the current markup gives a control no accessible name.
 */

const KDF_MS = 90_000;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class WalletPage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** Card sections carry their title as an h2 but no landmark name. */
  card(title: string): Locator {
    return this.page
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: title, exact: true }) });
  }

  /** Field labels are not associated with their inputs; the input is the label's next sibling. */
  field(scope: Locator, label: string): Locator {
    return scope.getByText(label, { exact: true }).locator('xpath=following-sibling::input[1]');
  }

  button(name: string, scope: Locator | Page = this.page): Locator {
    return scope.getByRole('button', { name, exact: true });
  }

  async clipboard(): Promise<string> {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  // ---- onboarding -------------------------------------------------------

  get onboarding(): Locator {
    return this.page.getByRole('heading', { name: 'Set up your wallet' });
  }

  async createWallet(password: string): Promise<{ phrase: string; address: string }> {
    await this.button('Create new wallet').click();
    const reveal = this.card('Your recovery phrase');
    await this.button('Copy', reveal).click();
    await expect(this.button('Copied', reveal)).toBeVisible();
    const phrase = await this.clipboard();
    expect(phrase.split(' ')).toHaveLength(24);
    await this.button('I wrote them down', reveal).click();
    await this.confirmWords(phrase);
    await this.setPassword(password);
    return { phrase, address: await this.address() };
  }

  async confirmWords(phrase: string): Promise<void> {
    const words = phrase.split(' ');
    const card = this.card('Confirm your phrase');
    const labels = card.getByText(/^Word #\d+$/);
    await expect(labels).toHaveCount(3);
    for (const label of await labels.all()) {
      const position = Number((await label.textContent())!.replace('Word #', ''));
      await label.locator('xpath=following-sibling::input[1]').fill(words[position - 1]);
    }
    await this.button('Continue', card).click();
  }

  async setPassword(password: string): Promise<void> {
    const card = this.card('Choose a password');
    await this.field(card, 'Password').fill(password);
    await this.field(card, 'Repeat password').fill(password);
    await this.button('Encrypt and finish', card).click();
    await expect(this.lockButton).toBeVisible({ timeout: KDF_MS });
  }

  async recover(phrase: string, password: string): Promise<string> {
    await this.button('Recover existing').click();
    const card = this.card('Recover a wallet');
    await card.getByRole('textbox').fill(phrase);
    await this.button('Continue', card).click();
    await this.setPassword(password);
    return this.address();
  }

  // ---- lock / unlock ----------------------------------------------------

  get lockButton(): Locator {
    return this.button('Lock');
  }

  get unlockScreen(): Locator {
    return this.page.getByRole('heading', { name: 'Unlock your wallet' });
  }

  get passwordError(): Locator {
    return this.page.getByText('Incorrect password.', { exact: true });
  }

  async lock(): Promise<void> {
    await this.lockButton.click();
    await expect(this.unlockScreen).toBeVisible();
  }

  async submitUnlock(password: string): Promise<void> {
    await this.page.getByLabel('Password').fill(password);
    await this.button('Unlock').click();
  }

  async unlock(password: string): Promise<void> {
    await this.submitUnlock(password);
    await expect(this.lockButton).toBeVisible({ timeout: KDF_MS });
  }

  // ---- dashboard --------------------------------------------------------

  /** The balance card has no title; it is the first card showing the BUNKER unit. */
  get balanceCard(): Locator {
    return this.page
      .locator('section')
      .filter({ has: this.page.getByText('BUNKER', { exact: true }) })
      .first();
  }

  /** The amount is an unlabeled span just before the unit. */
  get balance(): Locator {
    return this.balanceCard.getByText('BUNKER', { exact: true }).locator('xpath=preceding-sibling::span[1]');
  }

  get liveStatus(): Locator {
    return this.page.getByText('live', { exact: true });
  }

  async address(): Promise<string> {
    await this.button('Copy', this.balanceCard).click();
    const address = await this.clipboard();
    await expect(this.balanceCard.getByTitle(address, { exact: true })).toBeVisible();
    return address;
  }

  async expectBalance(units: number, timeout = FINALITY_MS): Promise<void> {
    await expect(this.balance).toHaveText(formatBunker(units), { timeout });
  }

  /** Token rows: ticker span followed by the raw amount span. */
  tokenBalance(ticker: string): Locator {
    return this.balanceCard.getByText(ticker, { exact: true }).locator('xpath=following-sibling::span[1]');
  }

  async requestFaucet(): Promise<void> {
    await this.button('Request 1 BUNKER', this.card('Faucet')).click();
  }

  async send(to: string, amount: string, asset?: string): Promise<void> {
    const card = this.card('Send');
    if (asset) await this.button(asset, card).click();
    await this.field(card, 'Recipient address').fill(to);
    await this.field(card, `Amount (${asset ?? 'BUNKER'})`).fill(amount);
    await this.button('Send', card).click();
  }

  async createToken(ticker: string, supply: number): Promise<void> {
    await this.button('Create a token…').click();
    const card = this.card('Create a token');
    await this.field(card, 'Symbol').fill(ticker);
    await this.field(card, 'Total supply').fill(String(supply));
    await this.button('Create token', card).click();
    await expect(this.button('Create a token…')).toBeVisible();
  }

  // ---- activity ---------------------------------------------------------

  /**
   * History rows are clickable divs with no role; the row is the parent of
   * its "↑ Sent 0.25to abcd…wxyz" label span.
   */
  historyRow(direction: 'Sent' | 'Received', amount: string): Locator {
    const arrow = direction === 'Sent' ? '↑' : '↓';
    const preposition = direction === 'Sent' ? 'to' : 'from';
    const text = new RegExp(`^${arrow} ${direction} ${escape(amount)}\\s*${preposition} \\S+$`);
    return this.card('Activity').getByText(text).locator('xpath=..');
  }

  pendingRow(label: string | RegExp): Locator {
    return this.card('Activity').getByText(label).locator('xpath=..');
  }

  async expectFinalized(row: Locator, timeout = FINALITY_MS): Promise<void> {
    await expect(row).toContainText('✓ finalized', { timeout });
  }

  /** Expands a row and returns label -> value of its detail table. */
  async txDetails(row: Locator): Promise<Record<string, string>> {
    await row.click();
    const table = row.locator('xpath=following-sibling::div[1]');
    await expect(table.getByText('View in explorer ↗')).toBeVisible();
    const rows = await table.locator('xpath=./div[count(span)=2]').all();
    const out: Record<string, string> = {};
    for (const r of rows) {
      const [label, value] = await r.locator('span').allTextContents();
      out[label] = value;
    }
    return out;
  }

  // ---- danger zone ------------------------------------------------------

  async eraseWallet(): Promise<void> {
    const card = this.card('Danger zone');
    await this.button('Remove wallet…', card).click();
    await this.button('Erase from this device', card).click();
    await expect(this.onboarding).toBeVisible();
  }

  async storedKeystore(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem('bunkercoin.keystore.v1'));
  }
}

/** The wallet's TxDetails shortening for values longer than 28 chars. */
export function shortValue(value: string): string {
  return value.length > 28 ? `${value.slice(0, 10)}…${value.slice(-10)}` : value;
}
