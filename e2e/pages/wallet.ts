import { expect, test, type Locator, type Page } from '@playwright/test';
import { FINALITY_MS, formatBunker } from '../harness/rpc';

/**
 * Every wallet selector lives here so a UI redesign touches one file.
 * Roles, labels and visible text; the few structural hops are marked where
 * the markup carries a value without an accessible name.
 */

const KDF_MS = 90_000;
const CHECK_MS = 60_000;

export const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** CopyValue buttons carry the full value in their title: `copy <value>`. */
export async function copyTarget(scope: Locator): Promise<string> {
  const title = await scope.locator('button[title^="copy "]').first().getAttribute('title');
  return title!.slice('copy '.length);
}

/** `<dl>` facts (receipts, tx details) as label -> value; CopyValue cells give their full value. */
export async function facts(scope: Locator): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const row of await scope.locator('dl > div').all()) {
    const label = (await row.locator('dt').textContent())!.trim();
    const dd = row.locator('dd');
    out[label] =
      (await dd.locator('button[title^="copy "]').count()) > 0
        ? await copyTarget(dd)
        : (await dd.textContent())!.replace(/\s+/g, ' ').trim();
  }
  return out;
}


/** An open transfer's activity tag: `sent · waiting for a block`, `in mempool · …`, `in block · finalizing`. */
export const IN_FLIGHT = /waiting for a block|finalizing/;
export class WalletPage {
  /** The password this wallet was last opened with, to get past the idle lock during long waits. */
  private password?: string;

  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  button(name: string | RegExp, scope: Locator | Page = this.page): Locator {
    return scope.getByRole('button', { name, exact: typeof name === 'string' });
  }

  heading(name: string | RegExp): Locator {
    return this.page.getByRole('heading', { name, exact: typeof name === 'string' });
  }

  get main(): Locator {
    return this.page.getByRole('main');
  }

  async clipboard(): Promise<string> {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  // ---- onboarding -------------------------------------------------------

  get onboarding(): Locator {
    return this.heading('BunkerCoin wallet.');
  }

  get phraseGrid(): Locator {
    return this.page.getByRole('list', { name: 'recovery phrase' });
  }

  /** Each word is an <li> led by its aria-hidden two-digit index. */
  async readPhrase(): Promise<string> {
    const cells = await this.phraseGrid.getByRole('listitem').allTextContents();
    return cells.map((c) => c.replace(/^\d+/, '').trim()).join(' ');
  }

  /** W03: the words mount only after the reveal tap, and nothing in the grid copies. */
  async revealPhrase(): Promise<string> {
    await expect(this.heading('Write down your 24 words.')).toBeVisible();
    await expect(this.phraseGrid).toHaveCount(0);
    await expect(this.button('i wrote them down')).toBeDisabled();
    await this.button('show words').click();
    await expect(this.phraseGrid.getByRole('button')).toHaveCount(0);
    const phrase = await this.readPhrase();
    expect(phrase.split(' ')).toHaveLength(24);
    return phrase;
  }

  async createWallet(password: string): Promise<{ phrase: string; address: string }> {
    await this.button(/^create a wallet/).click();
    const phrase = await this.revealPhrase();
    await this.button('i wrote them down').click();
    await this.confirmWords(phrase);
    await this.setPassword(password);
    this.password = password;
    await expect(this.heading('Wallet ready.')).toBeVisible({ timeout: KDF_MS });
    const ready = await copyTarget(this.main);
    await this.button('open wallet').click();
    await expect(this.lockButton).toBeVisible();
    const address = await this.address();
    expect(ready).toBe(address);
    return { phrase, address };
  }

  /** W04 pickers: one fieldset per position, legend `word 04`, four word chips. */
  get wordPickers(): Locator {
    return this.main.getByRole('group', { name: /^word \d+$/ });
  }

  async pickers(): Promise<{ picker: Locator; position: number }[]> {
    await expect(this.heading('Confirm 3 words.')).toBeVisible();
    await expect(this.wordPickers).toHaveCount(3);
    const out = [];
    for (const picker of await this.wordPickers.all()) {
      const legend = (await picker.locator('legend').textContent())!;
      out.push({ picker, position: Number(legend.replace('word ', '')) });
    }
    return out;
  }

  async confirmWords(phrase: string): Promise<void> {
    const words = phrase.split(' ');
    for (const { picker, position } of await this.pickers()) {
      await this.button(words[position - 1], picker).click();
    }
    await this.button('continue').click();
  }

  async setPassword(password: string): Promise<void> {
    await expect(this.heading('Set a password.')).toBeVisible();
    await this.page.getByLabel('password', { exact: true }).fill(password);
    await this.page.getByLabel('repeat password', { exact: true }).fill(password);
    await this.button('continue').click();
  }

  async recover(phrase: string, password: string): Promise<string> {
    await this.button(/^import a wallet/).click();
    await expect(this.heading('Enter your 24 words.')).toBeVisible();
    await this.page.getByLabel('recovery phrase', { exact: true }).fill(phrase);
    await expect(this.main.getByText('24 / 24 words · checksum ok', { exact: true })).toBeVisible();
    await this.button('continue').click();
    await this.setPassword(password);
    this.password = password;
    await expect(this.lockButton).toBeVisible({ timeout: KDF_MS });
    return this.address();
  }

  // ---- lock / unlock ----------------------------------------------------

  get lockButton(): Locator {
    return this.button('lock');
  }

  get unlockScreen(): Locator {
    return this.heading('Unlock.');
  }

  get passwordError(): Locator {
    return this.page.getByText('Wrong password.', { exact: true });
  }

  async lock(): Promise<void> {
    await this.lockButton.click();
    await expect(this.unlockScreen).toBeVisible();
  }

  async submitUnlock(password: string): Promise<void> {
    await this.page.getByLabel('password', { exact: true }).fill(password);
    await this.button('unlock').click();
  }

  async unlock(password: string): Promise<void> {
    this.password = password;
    await this.submitUnlock(password);
    await expect(this.lockButton).toBeVisible({ timeout: KDF_MS });
  }

  // ---- shell ------------------------------------------------------------

  nav(name: 'home' | 'activity' | 'settings'): Locator {
    return this.page.getByRole('navigation', { name: 'wallet' }).getByRole('link', { name, exact: true });
  }

  get homeView(): Locator {
    return this.heading('Home.');
  }

  async goHome(): Promise<void> {
    await this.nav('home').click();
    await expect(this.homeView).toBeAttached();
  }

  /** Live finality outlasts the 15 min idle lock, so a wait may find the wallet locked. */
  async ensureHome(): Promise<void> {
    if (this.password && (await this.unlockScreen.isVisible())) {
      test.info().annotations.push({ type: 'idle lock', description: `unlocked again at ${new Date().toISOString()}` });
      await this.unlock(this.password);
    }
    if ((await this.homeView.count()) === 0) await this.goHome();
  }

  /** Retries `check` from home until `timeout`, unlocking whenever the idle lock kicked in. */
  async eventually(check: (timeout: number) => Promise<void>, timeout: number): Promise<void> {
    await expect(async () => {
      await this.ensureHome();
      await check(Math.min(timeout, CHECK_MS));
    }).toPass({ timeout, intervals: [1_000] });
  }

  /** The header chip: `copy address 8Ep5…suHx`, full value in its title. */
  get addressChip(): Locator {
    return this.page.getByRole('banner').getByRole('button', { name: /^copy address / });
  }

  async address(): Promise<string> {
    await this.addressChip.click();
    const address = await this.clipboard();
    await expect(this.addressChip).toHaveAttribute('title', `copy ${address}`);
    return address;
  }

  /**
   * Header network tag. It reads `testnet` both while connecting and when live; only its tone
   * tells them apart (the live state has no accessible text), hence the data-tone hop.
   */
  get networkTag(): Locator {
    return this.page.getByRole('banner').locator('.bc-net');
  }

  get liveStatus(): Locator {
    return this.page.getByRole('banner').locator('.bc-net[data-tone="live"]').filter({ hasText: /^testnet$/ });
  }

  /** W25 bar under the header: `Offline. Can't reach <host>; values are from 21:02:11 UTC.` + [retry]. */
  get offlineBanner(): Locator {
    return this.page.getByRole('status').filter({ hasText: /^Offline\./ });
  }

  // ---- home -------------------------------------------------------------

  get actionTiles(): Locator {
    return this.page.getByRole('group', { name: 'actions' });
  }

  /** Tiles are links when usable and disabled buttons when not (faucet is always a button). */
  tile(name: 'send' | 'receive' | 'faucet' | 'token'): Locator {
    return this.actionTiles
      .getByRole('link', { name, exact: true })
      .or(this.actionTiles.getByRole('button', { name, exact: true }));
  }

  /** The hero amount has no accessible name; it is the balance-sized Amount inside the hero. */
  get balance(): Locator {
    return this.main.locator('.bc-hero .bc-bal');
  }

  async expectBalance(units: number, timeout = FINALITY_MS): Promise<void> {
    const text = new RegExp(`^${escape(formatBunker(units))}\\s*BUNKER$`);
    await this.eventually((t) => expect(this.balance).toHaveText(text, { timeout: t }), timeout);
  }

  get tokensList(): Locator {
    return this.page.getByRole('region', { name: 'tokens' });
  }

  /** Token rows: ticker over id; the held amount is the row's right-hand value cell. */
  tokenBalance(ticker: string): Locator {
    return this.tokensList
      .getByRole('listitem')
      .filter({ has: this.page.getByText(ticker, { exact: true }) })
      .locator('.bc-r');
  }

  async expectTokenBalance(ticker: string, value: string, timeout = FINALITY_MS): Promise<void> {
    await this.eventually((t) => expect(this.tokenBalance(ticker)).toHaveText(value, { timeout: t }), timeout);
  }

  async requestFaucet(): Promise<void> {
    await this.ensureHome();
    await this.tile('faucet').click();
  }

  // ---- send / create token ---------------------------------------------

  get assetPicker(): Locator {
    return this.page.getByLabel('asset', { exact: true });
  }

  /** W10 + W11 up to the W12 receipt. `asset` is a ticker; the picker lists tokens as `TICKER · id`. */
  async prepareSend(to: string, amount: string, asset?: string): Promise<void> {
    await this.ensureHome();
    await this.tile('send').click();
    await expect(this.heading('Send.')).toBeAttached();
    if (asset) {
      await this.assetPicker.click();
      const identity = new RegExp(`^${escape(asset)} · \\S+$`);
      await this.page.getByRole('list', { name: 'assets' }).getByRole('button').filter({ has: this.page.getByText(identity) }).click();
      await expect(this.assetPicker.getByText(identity)).toBeVisible();
    }
    await this.page.getByLabel('to', { exact: true }).fill(to);
    await this.button('next').click();
    await this.page.getByLabel('amount', { exact: true }).fill(amount);
    await this.button('review').click();
    await expect(this.receipt).toBeVisible();
  }

  get receipt(): Locator {
    return this.page.getByRole('region', { name: 'review before signing' });
  }

  /** W11 line under the amount: errors replace `available … · fee …`. */
  get amountAlert(): Locator {
    return this.main.getByRole('alert');
  }

  /** Receipt rows plus `nonce` (panel meta) and the foot address (`from` / `creator`). */
  async receiptFacts(): Promise<Record<string, string>> {
    const nonce = this.receipt.getByText(/^nonce \d+$/);
    await expect(nonce).toBeVisible();
    const out = await facts(this.receipt);
    out.nonce = (await nonce.textContent())!.replace('nonce ', '');
    const foot = this.receipt.getByText(/^(from|creator) /);
    out[(await foot.textContent())!.split(' ')[0]] = await copyTarget(foot);
    return out;
  }

  signButton(label: 'sign and send' | 'sign and create' = 'sign and send'): Locator {
    return this.button(label, this.main);
  }

  /** W13 nonce block: a notice with [check status]; signing stays disabled. */
  get nonceBlock(): Locator {
    return this.main.getByRole('alert').filter({ hasText: /^Nonce \d+ is still unconfirmed\. Another send could be rejected\./ });
  }

  async sign(label: 'sign and send' | 'sign and create' = 'sign and send'): Promise<void> {
    await expect(this.signButton(label)).toBeEnabled();
    await this.signButton(label).click();
    await expect(this.receipt).toHaveCount(0, { timeout: 30_000 });
  }

  async send(to: string, amount: string, asset?: string): Promise<void> {
    await this.prepareSend(to, amount, asset);
    await this.sign();
  }

  async createToken(ticker: string, supply: number): Promise<void> {
    await this.ensureHome();
    await this.tile('token').click();
    await this.page.getByLabel('symbol', { exact: true }).fill(ticker);
    await this.page.getByLabel('supply', { exact: true }).fill(String(supply));
    await expect(this.main.getByText('Available now · not reserved', { exact: true })).toBeVisible();
    await this.button('review').click();
    await expect(this.receipt).toBeVisible();
    await this.sign('sign and create');
    await expect(this.outcomeTitle).toHaveText(`Creating ${ticker}.`);
  }

  /** The send flow ends once the node acknowledged it: `Sent.` over what went where; finality is read from Activity. */
  async expectSent(what: string, timeout?: number): Promise<void> {
    await expect(this.outcomeTitle).toHaveText('Sent.', { timeout });
    await expect(this.main.getByText(new RegExp(`^${escape(what)} to `))).toBeVisible();
    await expect(this.main).toContainText('It lands in the next blocks; you can close this.');
  }

  /** W14-W16 and W21: the view's one h1. */
  get outcomeTitle(): Locator {
    return this.main.getByRole('heading', { level: 1 });
  }

  async done(): Promise<void> {
    await this.button('done', this.main).click();
    await expect(this.homeView).toBeAttached();
  }

  // ---- activity ---------------------------------------------------------

  /**
   * An activity row on the current view (home's latest three, or the activity list): kind over the
   * counterparty or ticker, signed amount right (`−0.250000`, `+1.000000`, `−100`), a tag only while not final.
   */
  activityRow(kind: string, ...texts: (string | RegExp)[]): Locator {
    let row = this.main.getByRole('listitem').filter({ has: this.page.getByText(kind, { exact: true }) });
    for (const t of texts) row = row.filter({ hasText: t });
    return row;
  }

  fact(label: string): Locator {
    return this.main
      .locator('dl > div')
      .filter({ has: this.page.locator('dt').getByText(label, { exact: true }) })
      .locator('dd');
  }

  async openTx(row: Locator): Promise<void> {
    await row.getByRole('link').click();
    await this.main.getByText('details', { exact: true }).click();
  }

  /** Waits for the chain record (the row shows its slot), then reads `execution` on its detail view. */
  async expectFinalized(row: Locator, timeout = FINALITY_MS): Promise<void> {
    await this.eventually((t) => expect(row).toContainText(/slot [\d,]+$/, { timeout: t }), timeout);
    await this.openTx(row);
    await expect(this.fact('execution')).toHaveText('succeeded', { timeout: 60_000 });
    await this.goHome();
  }

  /** W21 facts (CopyValue cells as full values) plus the headline `amount`. */
  async txDetails(row: Locator): Promise<Record<string, string>> {
    await this.openTx(row);
    const amount = (await this.outcomeTitle.textContent())!.replace(/\s+/g, ' ').trim();
    const out = { ...(await facts(this.main)), amount };
    await this.goHome();
    return out;
  }

  // ---- settings ---------------------------------------------------------

  async eraseWallet(): Promise<void> {
    await this.nav('settings').click();
    await expect(this.heading('Settings.')).toBeVisible();
    await this.button('erase wallet').click();
    const dialog = this.page.getByRole('dialog', { name: 'Erase this wallet.' });
    await expect(dialog).toBeVisible();
    await expect(this.button('erase', dialog)).toBeDisabled();
    await dialog.getByLabel('I have the 24 words.').check();
    await this.button('erase', dialog).click();
    await expect(this.onboarding).toBeVisible();
  }

  async storedKeystore(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem('bunkercoin.keystore.v1'));
  }
}
