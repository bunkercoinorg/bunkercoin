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
  await wallet.button('Create new wallet').click();
  await wallet.button('I wrote them down').click();
  const card = wallet.card('Confirm your phrase');
  for (const input of await card.getByRole('textbox').all()) await input.fill('wrong');
  await wallet.button('Continue', card).click();
  await expect(card.getByText('One or more words do not match. Check your notes.')).toBeVisible();
  await expect(wallet.card('Choose a password')).toHaveCount(0);
});
