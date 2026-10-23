/** `E2E_TARGET=live` runs the @live specs against the deployed testnet instead of a local simulated node. */
export const LIVE = process.env.E2E_TARGET === 'live';

export const LIVE_WALLET_URL = 'https://wallet.bunkercoin.com';
export const LIVE_RPC_URL = 'https://rpc.bunkercoin.com';
export const LIVE_EXPLORER_URL = 'https://explorer.bunkercoin.com';
