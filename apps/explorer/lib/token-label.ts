import type { TokenSummary } from './types.ts';

// The one place a token's display name is chosen; hosted metadata (name, icon) plugs in here later.
export const tokenLabel = (id: string, token?: Pick<TokenSummary, 'ticker'> | null) => token?.ticker || `token ${id}`;
