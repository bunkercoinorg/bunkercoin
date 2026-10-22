import { defineConfig, devices } from '@playwright/test';

// One shared simulated chain: airdrops are genesis-signed with the finalized
// nonce, so specs run serially to keep faucet transactions from colliding.
export default defineConfig({
  testDir: './specs',
  globalSetup: './harness/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Each finalized tx costs ~2-4 min on the half-duplex sim; the token spec waits on three.
  timeout: 30 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
