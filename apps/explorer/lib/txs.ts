import { formatInteger, formatUnits, normalizeTokenId } from '@bunkercoin/chain-format';
import type { TransactionDetails, TransactionPage } from './types.ts';

export const TX_PAGE_SIZE = 50;

export const TX_TYPES: Record<string, string> = {
  Transfer: 'transfer',
  TokenTransfer: 'token transfer',
  Mint: 'create token',
};

export const txType = (tx: TransactionDetails) => (tx.body ? (TX_TYPES[tx.body.type] ?? tx.body.type) : '–');

// `transfer 1.500000 BUNKER`, `12 RADIO`, `create RADIO · 1,000,000`; unknown is a dash.
export function txAmount(tx: TransactionDetails, ticker: (tokenId: string) => string): string {
  const b = tx.body;
  if (!b) return '–';
  if (b.type === 'Mint') return b.ticker === undefined ? '–' : `create ${b.ticker}${b.max_supply === undefined ? '' : ` · ${formatInteger(b.max_supply)}`}`;
  if (b.amount === undefined) return '–';
  const token = b.token_id ? normalizeTokenId(b.token_id) : null;
  return token ? `${formatInteger(b.amount)} ${ticker(token)}` : `${formatUnits(b.amount, 6)} BUNKER`;
}

export const txExecution = (tx: TransactionDetails) =>
  tx.status.success === true ? 'succeeded' : tx.status.success === false ? 'failed' : '–';

// `consumed` is the raw server offset. New transactions push older ones to higher
// offsets, so pages overlap and are de-duplicated, but the offset never rewinds.
export interface TxList {
  txs: TransactionDetails[];
  consumed: number;
  done: boolean;
}

export const emptyTxs: TxList = { txs: [], consumed: 0, done: false };

// The node collects up to offset + limit and reports how many it found, so a
// total below that means the scan ran out.
export function appendTxs(list: TxList, page: TransactionPage, limit: number): TxList {
  const seen = new Set(list.txs.map((t) => t.hash));
  const fresh = page.transactions.filter((t) => !seen.has(t.hash) && seen.add(t.hash));
  const consumed = list.consumed + page.transactions.length;
  return { txs: [...list.txs, ...fresh], consumed, done: page.transactions.length < limit || page.total < page.offset + limit };
}
