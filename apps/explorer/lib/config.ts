import { DEFAULT_STREAM_HOSTS, parseHostList } from './stream-url.ts';

// NEXT_PUBLIC_API_URL is the pre-split name for the node API; kept as a fallback.
export const NODE_API_URL =
  process.env.NEXT_PUBLIC_NODE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const NODE_WS_URL = NODE_API_URL.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';

export const EXPLORER_API_URL = process.env.NEXT_PUBLIC_EXPLORER_API_URL || 'http://localhost:8787';

export const WHEP_URL = process.env.NEXT_PUBLIC_WHEP_URL || undefined;
export const HLS_URL = process.env.NEXT_PUBLIC_STREAM_HLS_URL || undefined;
export const LIKE_WS_URL = process.env.NEXT_PUBLIC_LIKE_WS_URL || undefined;

export const STREAM_IFRAME_HOSTS = [
  ...DEFAULT_STREAM_HOSTS,
  ...parseHostList(process.env.NEXT_PUBLIC_STREAM_IFRAME_HOSTS),
];

export const WALLET_URL = process.env.NEXT_PUBLIC_WALLET_URL || 'https://wallet.bunkercoin.com';
export const SOURCE_URL = 'https://github.com/TheBunkerCoin/bunker_coin';
