import type { Json } from './json.ts';
import type {
  AccountDetails,
  Block,
  HolderPage,
  Node,
  RadioStats,
  SlotStatus,
  TokenSummary,
  TransactionBody,
  TransactionDetails,
  TransactionPage,
  TransactionStatus,
} from './types.ts';

export class ShapeError extends Error {
  constructor(path: string, expected: string) {
    super(`Unexpected response shape: ${path} is not ${expected}`);
    this.name = 'ShapeError';
  }
}

type Obj = { [key: string]: Json };

export function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ShapeError(path, 'an object');
  return v as Obj;
}

export function arr(v: unknown, path: string): Json[] {
  if (!Array.isArray(v)) throw new ShapeError(path, 'an array');
  return v;
}

export function str(v: unknown, path: string): string {
  if (typeof v !== 'string') throw new ShapeError(path, 'a string');
  return v;
}

const opt = <T>(v: unknown, f: (v: unknown) => T): T | undefined => (v === undefined || v === null ? undefined : f(v));

// Non-negative integer that fits a JS number exactly (slots, node ids, counts).
export function int(v: unknown, path: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new ShapeError(path, 'a safe integer');
  return v;
}

export function num(v: unknown, path: string): number {
  if (typeof v === 'bigint') return Number(v);
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ShapeError(path, 'a number');
  return v;
}

export function u64(v: unknown, path: string): bigint {
  if (typeof v === 'bigint' && v >= 0n) return v;
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
  if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
  throw new ShapeError(path, 'a u64');
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') throw new ShapeError(path, 'a boolean');
  return v;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], path: string): T {
  if (typeof v !== 'string' || !options.includes(v as T)) throw new ShapeError(path, options.join(' | '));
  return v as T;
}

// The node reports epoch ms; a value that only makes sense as seconds is scaled.
export function toMs(v: unknown, path: string): number | undefined {
  const n = opt(v, (x) => num(x, path));
  if (n === undefined || n <= 0) return undefined;
  return n < 1e12 ? n * 1000 : n;
}

const SLOT_STATUSES: readonly SlotStatus[] = ['pending', 'proposed', 'notarized', 'finalized'];

export function asBlock(v: unknown, path = 'block'): Block {
  const o = obj(v, path);
  const type = oneOf(o.type, ['block', 'skip'] as const, `${path}.type`);
  const block: Block = {
    type,
    slot: int(o.slot, `${path}.slot`),
    hash: str(o.hash, `${path}.hash`),
    status: oneOf(o.status, SLOT_STATUSES, `${path}.status`),
    proposed_timestamp: toMs(o.proposed_timestamp, `${path}.proposed_timestamp`),
    finalized_timestamp: toMs(o.finalized_timestamp, `${path}.finalized_timestamp`),
  };
  if (type === 'block') {
    block.producer = opt(o.producer, (x) => int(x, `${path}.producer`));
    block.parent_slot = opt(o.parent_slot, (x) => int(x, `${path}.parent_slot`));
    block.parent_hash = opt(o.parent_hash, (x) => str(x, `${path}.parent_hash`));
  }
  return block;
}

export const asBlocks = (v: unknown): Block[] => arr(v, 'blocks').map((b, i) => asBlock(b, `blocks[${i}]`));

export const asNodes = (v: unknown): Node[] =>
  arr(v, 'nodes').map((n, i) => {
    const o = obj(n, `nodes[${i}]`);
    return { node_id: int(o.node_id, `nodes[${i}].node_id`), finalized_slot: int(o.finalized_slot, `nodes[${i}].finalized_slot`) };
  });

function asBody(v: unknown): TransactionBody {
  const o = obj(v, 'tx.body');
  return {
    type: str(o.type, 'tx.body.type'),
    to: opt(o.to, (x) => str(x, 'tx.body.to')),
    amount: opt(o.amount, (x) => u64(x, 'tx.body.amount')),
    token_id: opt(o.token_id, (x) => str(x, 'tx.body.token_id')),
    ticker: opt(o.ticker, (x) => str(x, 'tx.body.ticker')),
    max_supply: opt(o.max_supply, (x) => u64(x, 'tx.body.max_supply')),
    metadata_hash: opt(o.metadata_hash, (x) => str(x, 'tx.body.metadata_hash')),
  };
}

function asTxStatus(v: unknown): TransactionStatus {
  const o = obj(v, 'tx.status');
  return {
    location: oneOf(o.location, ['mempool', 'confirmed', 'finalized'] as const, 'tx.status.location'),
    slot: opt(o.slot, (x) => int(x, 'tx.status.slot')),
    block_hash: opt(o.block_hash, (x) => str(x, 'tx.status.block_hash')),
    executed: opt(o.executed, (x) => bool(x, 'tx.status.executed')),
    success: opt(o.success, (x) => bool(x, 'tx.status.success')),
    error: opt(o.error, (x) => str(x, 'tx.status.error')),
  };
}

export function asTransaction(v: unknown): TransactionDetails {
  const o = obj(v, 'tx');
  return {
    hash: str(o.hash, 'tx.hash'),
    sender: str(o.sender, 'tx.sender'),
    nonce: u64(o.nonce, 'tx.nonce'),
    fee: u64(o.fee, 'tx.fee'),
    body: opt(o.body, asBody),
    status: asTxStatus(o.status),
  };
}

export function asTransactionPage(v: unknown): TransactionPage {
  const o = obj(v, 'transactions');
  return {
    transactions: arr(o.transactions, 'transactions.transactions').map((t, i) => asTransaction(obj(t, `transactions[${i}]`))),
    total: int(o.total, 'transactions.total'),
    offset: int(o.offset, 'transactions.offset'),
    limit: int(o.limit, 'transactions.limit'),
  };
}

export function asAccount(v: unknown): AccountDetails {
  const o = obj(v, 'account');
  const balances = obj(o.token_balances ?? {}, 'account.token_balances');
  return {
    pubkey: str(o.pubkey, 'account.pubkey'),
    native_balance: u64(o.native_balance, 'account.native_balance'),
    nonce: u64(o.nonce, 'account.nonce'),
    token_balances: Object.fromEntries(
      Object.entries(balances).map(([id, bal]) => [id, u64(bal, `account.token_balances.${id}`)]),
    ),
  };
}

export function asToken(v: unknown, path = 'token'): TokenSummary {
  const o = obj(v, path);
  return {
    id: str(o.id, `${path}.id`),
    ticker: str(o.ticker, `${path}.ticker`),
    current_supply: u64(o.current_supply, `${path}.current_supply`),
    max_supply: opt(o.max_supply, (x) => u64(x, `${path}.max_supply`)),
    creator: opt(o.creator, (x) => str(x, `${path}.creator`)),
    metadata_hash: opt(o.metadata_hash, (x) => str(x, `${path}.metadata_hash`)),
  };
}

export const asTokens = (v: unknown): TokenSummary[] =>
  arr(obj(v, 'tokens').tokens, 'tokens.tokens').map((t, i) => asToken(t, `tokens[${i}]`));

export function asHolderPage(v: unknown): HolderPage {
  const o = obj(v, 'holders');
  return {
    holders: arr(o.holders, 'holders.holders').map((h, i) => {
      const r = obj(h, `holders[${i}]`);
      return { pubkey: str(r.pubkey, `holders[${i}].pubkey`), balance: u64(r.balance, `holders[${i}].balance`) };
    }),
    total: int(o.total, 'holders.total'),
    offset: int(o.offset, 'holders.offset'),
    limit: int(o.limit, 'holders.limit'),
  };
}

export function asRadioStats(v: unknown, receivedAt: number): RadioStats {
  const o = obj(v, 'radio_stats');
  const n = (k: string) => num(o[k] ?? 0, `radio_stats.${k}`);
  return {
    packets_sent_2s: n('packets_sent_2s'),
    packets_dropped_2s: n('packets_dropped_2s'),
    packets_transmitted_2s: n('packets_transmitted_2s'),
    packets_queued: n('packets_queued'),
    bytes_transmitted_2s: n('bytes_transmitted_2s'),
    bytes_received_2s: n('bytes_received_2s'),
    effective_throughput_bps_2s: n('effective_throughput_bps_2s'),
    packet_loss_rate_2s: n('packet_loss_rate_2s'),
    link_speed_level: n('link_speed_level'),
    received_at: receivedAt,
  };
}
