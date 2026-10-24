import { isObject, parseJson, stringifyJson, U64_MAX, type Json } from '@bunkercoin/chain-format';
import { hexToBase58, isTokenId, type SignedTransaction } from './keys.ts';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.bunkercoin.com/';

// Radio finality: seconds on a healthy HF link, minutes through band fades.
export const CONFIRM_POLL_MS = 5_000;
export const CONFIRM_TIMEOUT_MS = 15 * 60_000;
export const RPC_TIMEOUT_MS = 10_000;
// The node recommends 100 units; anything far above is an RPC we refuse to trust with a signature.
export const MAX_FEE_UNITS = 10_000n;
const HISTORY_PAGE = 200;

export type RpcErrorKind = 'network' | 'timeout' | 'aborted' | 'http' | 'protocol' | 'rpc';

export class RpcError extends Error {
  readonly method: string;
  readonly kind: RpcErrorKind;
  readonly code: number | null;
  constructor(method: string, kind: RpcErrorKind, message: string, code: number | null = null) {
    super(`${method}: ${message}`);
    this.method = method;
    this.kind = kind;
    this.code = code;
  }
}

export class ConfirmCancelledError extends Error {
  constructor() {
    super('confirmation cancelled');
  }
}

export class ConfirmTimeoutError extends Error {
  constructor() {
    super('Confirmation timed out; the transaction may still finalize later');
  }
}

export class TxFailedError extends Error {}

export interface AccountInfo {
  lamports: bigint;
  nonce: bigint;
}

export interface TokenBalance {
  tokenId: string;
  ticker: string | null;
  balance: bigint;
  /** 64 lowercase hex; null when the node sent no token record. */
  metadataHash: string | null;
  /** Base58 address, comparable with the wallet's own; null as above. */
  creator: string | null;
}

export const NATIVE_TICKER = 'BUNKER';

/** A custom token may legally be ticked BUNKER; its label must not pass for the native asset. */
export function tokenLabel(t: { tokenId: string; ticker: string | null }): string {
  if (!t.ticker) return `Token ${t.tokenId}`;
  return t.ticker === NATIVE_TICKER ? `${t.ticker} (token ${t.tokenId})` : t.ticker;
}

export interface TokenMeta {
  id: string;
  ticker: string;
  maxSupply: bigint;
  currentSupply: bigint;
  /** 64 lowercase hex. */
  metadataHash: string;
  /** Base58 address. */
  creator: string;
}

export interface SignatureStatus {
  confirmationStatus: 'processed' | 'finalized';
  err: Json;
}

export type TxBody =
  | { type: 'Transfer'; to: string; amount: bigint }
  | { type: 'TokenTransfer'; to: string; tokenId: string; amount: bigint }
  | { type: 'Mint'; ticker: string; maxSupply: bigint; metadataHash: string }
  | { type: 'UpdateMetadata'; tokenId: string; metadataHash: string }
  | { type: 'Burn'; tokenId: string; amount: bigint }
  | { type: 'Other'; name: string };

export type TxOutcome = { kind: 'success' } | { kind: 'failed'; error: string | null } | { kind: 'unknown' };

export interface ChainTransaction {
  hash: string;
  /** Hex, as the node lists it. */
  sender: string;
  nonce: bigint;
  fee: bigint;
  slot: bigint;
  body: TxBody;
  outcome: TxOutcome;
}

export interface AccountHistory {
  transactions: ChainTransaction[];
  /** Network transactions examined to find them. */
  scanned: number;
  /**
   * 'exhausted': the whole list was scanned. 'enough': `want` matches were found, older ones may exist.
   * 'scan-limit': the page budget ran out first, so older wallet activity may be missing.
   */
  end: HistoryEnd;
}

export type HistoryEnd = 'exhausted' | 'enough' | 'scan-limit';

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ConfirmOptions {
  pollMs?: number;
  timeoutMs?: number;
  onStatus?: (status: SignatureStatus | null) => void;
  signal?: AbortSignal;
}

type Obj = { [key: string]: Json };

const HEX32 = /^[0-9a-f]{64}$/;

function bad(method: string, what: string): RpcError {
  return new RpcError(method, 'protocol', `malformed ${what}`);
}

function u64(method: string, v: Json | undefined, what: string): bigint {
  if (typeof v === 'bigint' && v >= 0n && v <= U64_MAX) return v;
  throw bad(method, what);
}

function str(method: string, v: Json | undefined, what: string): string {
  if (typeof v === 'string') return v;
  throw bad(method, what);
}

function obj(method: string, v: Json | undefined, what: string): Obj {
  if (isObject(v)) return v;
  throw bad(method, what);
}

/** Solana RpcResponse: {context, value}. */
function value(method: string, result: Json): Json {
  const o = obj(method, result, 'response');
  if (!('value' in o)) throw bad(method, 'response');
  return o.value;
}

function hex32(method: string, v: Json | undefined, what: string): string {
  const s = str(method, v, what);
  if (!HEX32.test(s)) throw bad(method, what);
  return s;
}

function tokenId(method: string, v: Json | undefined): string {
  if (isTokenId(v)) return v;
  throw bad(method, 'token id');
}

function decodeBody(method: string, v: Json | undefined): TxBody {
  const b = obj(method, v, 'transaction body');
  const type = str(method, b.type, 'transaction type');
  switch (type) {
    case 'Transfer':
      return { type, to: hex32(method, b.to, 'recipient'), amount: u64(method, b.amount, 'amount') };
    case 'TokenTransfer':
      return {
        type,
        to: hex32(method, b.to, 'recipient'),
        tokenId: tokenId(method, b.token_id),
        amount: u64(method, b.amount, 'amount'),
      };
    case 'Mint':
      return {
        type,
        ticker: str(method, b.ticker, 'ticker'),
        maxSupply: u64(method, b.max_supply, 'supply'),
        metadataHash: hex32(method, b.metadata_hash, 'metadata hash'),
      };
    case 'UpdateMetadata':
      return { type, tokenId: tokenId(method, b.token_id), metadataHash: hex32(method, b.metadata_hash, 'metadata hash') };
    case 'Burn':
      return { type, tokenId: tokenId(method, b.token_id), amount: u64(method, b.amount, 'amount') };
    default:
      return { type: 'Other', name: type };
  }
}

function decodeTokenMeta(method: string, v: Json | undefined): TokenMeta {
  const t = obj(method, v, 'token');
  return {
    id: tokenId(method, t.id),
    ticker: str(method, t.ticker, 'ticker'),
    maxSupply: u64(method, t.max_supply, 'max supply'),
    currentSupply: u64(method, t.current_supply, 'supply'),
    metadataHash: hex32(method, t.metadata_hash, 'metadata hash'),
    creator: hexToBase58(hex32(method, t.creator, 'creator')),
  };
}

function decodeOutcome(method: string, v: Json | undefined): TxOutcome {
  if (!isObject(v) || v.location !== 'finalized') return { kind: 'unknown' };
  if (v.success === true) return { kind: 'success' };
  if (v.success === false) return { kind: 'failed', error: typeof v.error === 'string' ? v.error : null };
  throw bad(method, 'transaction status');
}

function decodeTransaction(method: string, v: Json): ChainTransaction {
  const t = obj(method, v, 'transaction');
  return {
    hash: hex32(method, t.hash, 'transaction hash'),
    sender: hex32(method, t.sender, 'sender'),
    nonce: u64(method, t.nonce, 'nonce'),
    fee: u64(method, t.fee, 'fee'),
    slot: u64(method, t.slot, 'slot'),
    body: decodeBody(method, t.body),
    outcome: decodeOutcome(method, t.status),
  };
}

/** Errors in a status are chain errors; their message is what the user needs. */
function errText(err: Json): string {
  if (isObject(err) && typeof err.message === 'string') return err.message;
  return stringifyJson(err);
}

/** A status without an explicit outcome is malformed, never a success. */
function statusErr(method: string, status: Obj): Json {
  if ('err' in status) return status.err;
  const outcome = status.status;
  if (isObject(outcome) && 'Ok' in outcome) return null;
  if (isObject(outcome) && 'Err' in outcome && outcome.Err !== null) return outcome.Err;
  throw bad(method, 'status outcome');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

export interface TransactionLookup {
  sender: string;
  nonce: bigint;
  /** 'mempool' | 'confirmed' | 'finalized'. */
  location: string;
}

/** The node takes base64-encoded JSON; these exact bytes are what a rebroadcast resends. */
export function encodeTransaction(tx: SignedTransaction): string {
  return btoa(stringifyJson(tx));
}

export function touchesAccount(tx: ChainTransaction, addressHex: string): boolean {
  if (tx.sender === addressHex) return true;
  return (tx.body.type === 'Transfer' || tx.body.type === 'TokenTransfer') && tx.body.to === addressHex;
}

export class BunkerConnection {
  readonly url: string;
  private id = 0;

  constructor(url: string = RPC_URL) {
    this.url = url;
  }

  async rpc(method: string, params: unknown[] = [], { signal, timeoutMs = RPC_TIMEOUT_MS }: RequestOptions = {}): Promise<Json> {
    if (signal?.aborted) throw new RpcError(method, 'aborted', 'request cancelled');
    const id = ++this.id;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const forward = () => ctrl.abort();
    signal?.addEventListener('abort', forward, { once: true });
    let text: string;
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stringifyJson({ jsonrpc: '2.0', id, method, params }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new RpcError(method, 'http', `HTTP ${res.status}`, res.status);
      text = await res.text();
    } catch (e) {
      if (e instanceof RpcError) throw e;
      if (signal?.aborted) throw new RpcError(method, 'aborted', 'request cancelled');
      if (ctrl.signal.aborted) throw new RpcError(method, 'timeout', `no response within ${Math.round(timeoutMs / 1000)}s`);
      throw new RpcError(method, 'network', 'node unreachable');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    }
    let body: Json;
    try {
      body = parseJson(text);
    } catch {
      throw bad(method, 'response (not JSON)');
    }
    if (!isObject(body) || body.jsonrpc !== '2.0' || body.id !== BigInt(id)) {
      throw new RpcError(method, 'protocol', 'response does not match the request');
    }
    if ('error' in body) {
      const err = body.error;
      if (!isObject(err) || typeof err.message !== 'string' || typeof err.code !== 'bigint') throw bad(method, 'error');
      throw new RpcError(method, 'rpc', err.message, Number(err.code));
    }
    if (!('result' in body)) throw bad(method, 'response');
    return body.result;
  }

  async getBalance(address: string, opts?: RequestOptions): Promise<bigint> {
    return u64('getBalance', value('getBalance', await this.rpc('getBalance', [address], opts)), 'balance');
  }

  /** null for accounts the chain has never seen. */
  async getAccountInfo(address: string, opts?: RequestOptions): Promise<AccountInfo | null> {
    const m = 'getAccountInfo';
    const v = value(m, await this.rpc(m, [address], opts));
    if (v === null) return null;
    const account = obj(m, v, 'account');
    const data = obj(m, account.data, 'account data');
    return { lamports: u64(m, account.lamports, 'balance'), nonce: u64(m, data.nonce, 'nonce') };
  }

  async getNonce(address: string, opts?: RequestOptions): Promise<bigint> {
    return (await this.getAccountInfo(address, opts))?.nonce ?? 0n;
  }

  /** Node shape: {value: {pubkey, tokens: [{token_id, balance, ticker?}]}}. */
  async getTokenBalances(address: string, opts?: RequestOptions): Promise<TokenBalance[]> {
    const m = 'getTokenAccountsByOwner';
    const v = value(m, await this.rpc(m, [address], opts));
    if (v === null) return [];
    const tokens = obj(m, v, 'token accounts').tokens;
    if (!Array.isArray(tokens)) throw bad(m, 'token list');
    return tokens.map((t) => {
      const entry = obj(m, t, 'token balance');
      if (entry.ticker !== undefined && typeof entry.ticker !== 'string') throw bad(m, 'ticker');
      return {
        tokenId: tokenId(m, entry.token_id),
        ticker: entry.ticker || null,
        balance: u64(m, entry.balance, 'token balance'),
        metadataHash: entry.metadata_hash === undefined ? null : hex32(m, entry.metadata_hash, 'metadata hash'),
        creator: entry.creator === undefined ? null : hexToBase58(hex32(m, entry.creator, 'creator')),
      };
    });
  }

  /** All tokens on the chain; used to catch ticker collisions before signing. */
  async getTokens(opts?: RequestOptions): Promise<TokenMeta[]> {
    const m = 'getTokens';
    const list = obj(m, await this.rpc(m, [], opts), 'token list').tokens;
    if (!Array.isArray(list)) throw bad(m, 'token list');
    return list.map((t) => decodeTokenMeta(m, t));
  }

  /** null when the node has no such token. */
  async getToken(id: string, opts?: RequestOptions): Promise<TokenMeta | null> {
    const m = 'getToken';
    try {
      return decodeTokenMeta(m, await this.rpc(m, [id], opts));
    } catch (e) {
      if (e instanceof RpcError && e.kind === 'rpc' && /token not found/.test(e.message)) return null;
      throw e;
    }
  }

  /** Recommended fee, refused when above MAX_FEE_UNITS. */
  async getFee(opts?: RequestOptions): Promise<bigint> {
    const m = 'getFeeForMessage';
    const fee = u64(m, value(m, await this.rpc(m, [null], opts)), 'fee');
    if (fee > MAX_FEE_UNITS) throw new RpcError(m, 'protocol', `fee ${fee} is above the wallet cap of ${MAX_FEE_UNITS}`);
    return fee;
  }

  async getSlot(opts?: RequestOptions): Promise<bigint> {
    return u64('getSlot', await this.rpc('getSlot', [], opts), 'slot');
  }

  /** Finalization instants (epoch ms) of recent finalized blocks; skips and undated blocks are left out. */
  async getBlockTimes(limit = 20, opts?: RequestOptions): Promise<number[]> {
    const m = 'getBlocks';
    const res = await this.rpc(m, [limit, 0], opts);
    const list = Array.isArray(res) ? res : isObject(res) && Array.isArray(res.blocks) ? res.blocks : null;
    if (list === null) throw bad(m, 'block list');
    return list.flatMap((b) => {
      if (!isObject(b) || b.type !== 'block' || b.status !== 'finalized') return [];
      const t = b.finalized_timestamp;
      const n = typeof t === 'bigint' ? Number(t) : typeof t === 'number' ? t : 0;
      if (!(n > 0)) return [];
      return [n < 1e12 ? n * 1000 : n];
    });
  }

  /** Global newest-first page; the node has no per-account filter. */
  async getTransactions(limit = HISTORY_PAGE, offset = 0, opts?: RequestOptions): Promise<ChainTransaction[]> {
    const m = 'getTransactions';
    const list = obj(m, await this.rpc(m, [limit, offset], opts), 'transaction list').transactions;
    if (!Array.isArray(list)) throw bad(m, 'transaction list');
    return list.map((t) => decodeTransaction(m, t));
  }

  /** Pages through the global list until `want` matches are found or `maxPages` pages were scanned. */
  async getAccountHistory(
    addressHex: string,
    { want = 10, maxPages = 3, ...opts }: RequestOptions & { want?: number; maxPages?: number } = {},
  ): Promise<AccountHistory> {
    const found: ChainTransaction[] = [];
    let scanned = 0;
    for (let page = 0; page < maxPages; page++) {
      const txs = await this.getTransactions(HISTORY_PAGE, page * HISTORY_PAGE, opts);
      scanned += txs.length;
      found.push(...txs.filter((t) => touchesAccount(t, addressHex)));
      if (found.length >= want) return { transactions: found.slice(0, want), scanned, end: 'enough' };
      if (txs.length < HISTORY_PAGE) return { transactions: found, scanned, end: 'exhausted' };
    }
    return { transactions: found, scanned, end: 'scan-limit' };
  }

  /** tx object -> base58 id. */
  async sendTransaction(tx: SignedTransaction, opts?: RequestOptions): Promise<string> {
    return this.sendRawTransaction(encodeTransaction(tx), opts);
  }

  async sendRawTransaction(wire: string, opts?: RequestOptions): Promise<string> {
    return str('sendTransaction', await this.rpc('sendTransaction', [wire], opts), 'transaction id');
  }

  /** Lookup by hex hash. The mempool reports the sender as submitted (base58), blocks as hex. */
  async getTransaction(hashHex: string, opts?: RequestOptions): Promise<TransactionLookup> {
    const m = 'getTransaction';
    const t = obj(m, await this.rpc(m, [hashHex], opts), 'transaction');
    const status = obj(m, t.status, 'transaction status');
    return {
      sender: str(m, t.sender, 'sender'),
      nonce: u64(m, t.nonce, 'nonce'),
      location: str(m, status.location, 'transaction location'),
    };
  }

  async requestAirdrop(address: string, amount: bigint, opts?: RequestOptions): Promise<string> {
    return str('requestAirdrop', await this.rpc('requestAirdrop', [address, amount], opts), 'transaction id');
  }

  async getSignatureStatuses(txIds: string[], opts?: RequestOptions): Promise<(SignatureStatus | null)[]> {
    const m = 'getSignatureStatuses';
    const list = value(m, await this.rpc(m, [txIds], opts));
    if (!Array.isArray(list) || list.length !== txIds.length) throw bad(m, 'status list');
    return list.map((s) => {
      if (s === null) return null;
      const status = obj(m, s, 'status');
      const level = status.confirmationStatus;
      if (level !== 'processed' && level !== 'finalized') throw bad(m, 'confirmation status');
      return { confirmationStatus: level, err: statusErr(m, status) };
    });
  }

  async getSignatureStatus(txId: string, opts?: RequestOptions): Promise<SignatureStatus | null> {
    return (await this.getSignatureStatuses([txId], opts))[0];
  }

  /** Polls until finalized; onStatus fires each poll so the UI can show progress. */
  async confirm(
    txId: string,
    { pollMs = CONFIRM_POLL_MS, timeoutMs = CONFIRM_TIMEOUT_MS, onStatus, signal }: ConfirmOptions = {},
  ): Promise<SignatureStatus> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new ConfirmCancelledError();
      let status: SignatureStatus | null = null;
      try {
        const left = Math.max(1, deadline - Date.now());
        status = await this.getSignatureStatus(txId, { signal, timeoutMs: Math.min(RPC_TIMEOUT_MS, left) });
      } catch {
        // Transient RPC failures must not kill a confirmation that will land.
      }
      if (signal?.aborted) throw new ConfirmCancelledError();
      onStatus?.(status);
      if (status && status.err !== null) throw new TxFailedError(`Transaction failed: ${errText(status.err)}`);
      if (status?.confirmationStatus === 'finalized') return status;
      await sleep(Math.min(pollMs, Math.max(0, deadline - Date.now())), signal);
    }
    throw new ConfirmTimeoutError();
  }
}
