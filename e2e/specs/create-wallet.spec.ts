import { test, expect, PASSWORD } from '../harness/fixtures';

test('create wallet: phrase, backup confirmation, password, dashboard', async ({ openWallet, rpc }) => {
  const wallet = await openWallet();
  await expect(wallet.onboarding).toBeVisible();

  const { phrase, address } = await wallet.createWallet(PASSWORD);

  expect(new Set(phrase.split(' ')).size).toBeGreaterThan(1);
  expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  await expect(wallet.liveStatus).toBeVisible({ timeout: 60_000 });
  await wallet.expectBalance(0, 60_000);
  expect(await rpc.getBalance(address)).toBe(0);
  expect(await wallet.storedKeystore()).not.toContain(phrase);
});

test('create wallet: wrong backup words are rejected', async ({ openWallet }) => {
  const wallet = await openWallet();
  await wallet.button(/^create a wallet/).click();
  const words = (await wallet.revealPhrase()).split(' ');
  await wallet.button('i wrote them down').click();
  for (const { picker, position } of await wallet.pickers()) {
    const wrong = (await picker.getByRole('button').allTextContents()).find((w) => w !== words[position - 1])!;
    await wallet.button(wrong, picker).click();
    await expect(wallet.button(wrong, picker)).toHaveAttribute('aria-pressed', 'true');
    const at = words.indexOf(wrong);
    await expect(picker.getByRole('alert')).toHaveText(
      at === -1 ? `Not word ${position}.` : `That is word ${at + 1}. Pick word ${position}.`,
    );
  }
  await expect(wallet.button('continue')).toBeDisabled();
  await expect(wallet.heading('Set a password.')).toHaveCount(0);
});
