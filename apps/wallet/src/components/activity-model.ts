import { shortId } from '@bunkercoin/chain-format';
import type { IconName } from '@bunkercoin/ui';
import type { AccountHistory, ChainTransaction, TokenBalance, TokenMeta } from '@/lib/connection';
import { hexToBase58 } from '@/lib/keys';
import type { PendingTx } from '@/lib/pending';
import { count } from '@/components/assets';

export type ItemStatus = 'pending' | 'unconfirmed' | 'uncertain' | 'failed' | 'final' | 'final-failed' | 'final-unknown';

export interface ActivityItem {
  /** base58 transaction id, the `#tx/<id>` param. */
  id: string;
  kind: string;
  icon: IconName;
  sub: string;
  amount: { units: bigint; scale: 0 | 6; sign?: '+' | '-'; unit: string } | null;
  status: ItemStatus;
  /** When this wallet submitted it (pending only; the node reports no timestamps). */
  at: number | null;
  slot: bigint | null;
  counterparty: { label: 'to' | 'from'; address: string } | null;
  fee: bigint | null;
  nonce: bigint | null;
  error: string | null;
  hashHex: string | null;
  pending: PendingTx | null;
}

type Tickers = Map<string, string>;

const tokenLabel = (tickers: Tickers, id: string) => tickers.get(id) ?? `token ${id}`;

export function tickerMap(tokens: TokenBalance[], registry: TokenMeta[] | null): Tickers {
  const m = new Map<string, string>();
  registry?.forEach((r) => r.ticker && m.set(r.id, r.ticker));
  tokens.forEach((t) => t.ticker && m.set(t.tokenId, t.ticker));
  return m;
}

export const isOpen = (s: ItemStatus) => s === 'pending' || s === 'unconfirmed' || s === 'uncertain';

export function fromPending(p: PendingTx): ActivityItem {
  const status: ItemStatus = p.state;
  const base = {
    id: p.txId,
    status,
    at: p.at,
    slot: null,
    fee: null,
    nonce: p.nonce,
    error: p.error ?? null,
    hashHex: null,
    pending: p,
  };
  const to = p.to ? { label: 'to' as const, address: p.to } : null;
  switch (p.kind) {
    case 'faucet':
      return { ...base, kind: 'faucet', icon: 'faucet', sub: 'testnet', amount: { units: p.amount, scale: 6, unit: 'BUNKER', sign: '+' }, counterparty: null };
    case 'metadata':
      return { ...base, kind: 'token details', icon: 'plus', sub: p.ticker ?? '', amount: null, counterparty: null };
    case 'mint':
      return { ...base, kind: 'create token', icon: 'plus', sub: p.ticker ?? '', amount: { units: p.amount, scale: 0, unit: p.ticker ?? '' }, counterparty: null };
    case 'token-send':
      return {
        ...base,
        kind: 'token send',
        icon: 'send',
        sub: `${count(p.amount)} ${p.ticker ?? ''} to ${shortId(p.to ?? '')}`,
        amount: { units: p.amount, scale: 0, sign: '-', unit: p.ticker ?? '' },
        counterparty: to,
      };
    default:
      return { ...base, kind: 'send', icon: 'send', sub: `to ${shortId(p.to ?? '')}`, amount: { units: p.amount, scale: 6, unit: 'BUNKER', sign: '-' }, counterparty: to };
  }
}

export function fromChain(t: ChainTransaction, meHex: string, tickers: Tickers): ActivityItem {
  const outgoing = t.sender === meHex;
  const status: ItemStatus =
    t.outcome.kind === 'success' ? 'final' : t.outcome.kind === 'failed' ? 'final-failed' : 'final-unknown';
  const base = {
    id: hexToBase58(t.hash),
    status,
    at: null,
    slot: t.slot,
    fee: t.fee,
    nonce: outgoing ? t.nonce : null,
    error: t.outcome.kind === 'failed' ? (t.outcome.error ?? 'failed') : null,
    hashHex: t.hash,
    pending: null,
  };
  const b = t.body;
  if (b.type === 'Transfer' || b.type === 'TokenTransfer') {
    const other = hexToBase58(outgoing ? b.to : t.sender);
    const counterparty = { label: outgoing ? ('to' as const) : ('from' as const), address: other };
    const dir = `${outgoing ? 'to' : 'from'} ${shortId(other)}`;
    if (b.type === 'Transfer') {
      return {
        ...base,
        kind: outgoing ? 'send' : 'receive',
        icon: outgoing ? 'send' : 'receive',
        sub: dir,
        amount: { units: b.amount, scale: 6, unit: 'BUNKER', sign: outgoing ? '-' : '+' },
        counterparty,
      };
    }
    return {
      ...base,
      kind: outgoing ? 'token send' : 'receive',
      icon: outgoing ? 'send' : 'receive',
      sub: `${count(b.amount)} ${tokenLabel(tickers, b.tokenId)} ${dir}`,
      amount: { units: b.amount, scale: 0, sign: outgoing ? '-' : '+', unit: tokenLabel(tickers, b.tokenId) },
      counterparty,
    };
  }
  if (b.type === 'Mint') {
    return { ...base, kind: 'create token', icon: 'plus', sub: b.ticker, amount: { units: b.maxSupply, scale: 0, unit: b.ticker }, counterparty: null };
  }
  if (b.type === 'UpdateMetadata') {
    return { ...base, kind: 'token details', icon: 'plus', sub: tokenLabel(tickers, b.tokenId), amount: null, counterparty: null };
  }
  if (b.type === 'Burn') {
    return { ...base, kind: 'burn', icon: 'send', sub: tokenLabel(tickers, b.tokenId), amount: { units: b.amount, scale: 0, sign: '-', unit: tokenLabel(tickers, b.tokenId) }, counterparty: null };
  }
  return { ...base, kind: b.name.toLowerCase(), icon: 'activity', sub: shortId(base.id), amount: null, counterparty: null };
}

/** This wallet's open submissions first, then what the chain scan found, without duplicates. */
export function activityItems(
  pending: PendingTx[],
  history: AccountHistory | null,
  meHex: string,
  tickers: Tickers,
): ActivityItem[] {
  const open = pending.map(fromPending);
  const ids = new Set(open.map((i) => i.id));
  const chain = (history?.transactions ?? []).map((t) => fromChain(t, meHex, tickers)).filter((i) => !ids.has(i.id));
  return [...open, ...chain];
}
