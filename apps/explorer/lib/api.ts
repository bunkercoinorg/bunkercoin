import { NODE_API_URL } from './config.ts';
import { parseJson, type Json } from './json.ts';
import { joinUrl, nodePaths } from './routes.ts';
import { normalizeHash, normalizeSlot, normalizeTokenId } from '@bunkercoin/chain-format';
import { resolveSearch } from './search.ts';
import {
  asAccount,
  asBlock,
  asBlocks,
  asHolderPage,
  asNodes,
  asToken,
  asTokens,
  asTransaction,
  ShapeError,
} from './guards.ts';
import type {
  AccountDetails,
  Block,
  HolderPage,
  Node,
  SearchMatch,
  TokenSummary,
  TransactionDetails,
} from './types.ts';

export class ApiError extends Error {
  readonly kind: 'network' | 'http' | 'shape';
  readonly status?: number;

  constructor(kind: 'network' | 'http' | 'shape', message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.kind === 'network') return 'The node API is unreachable.';
    if (e.kind === 'http') return `The node API answered ${e.status}.`;
    return 'The node API sent an unexpected response.';
  }
  return e instanceof Error ? e.message : 'Request failed.';
}

interface RequestOptions {
  signal?: AbortSignal;
}

// Resolves to null only on 404; every other failure throws an ApiError.
async function request(path: string, { signal }: RequestOptions = {}): Promise<Json | null> {
  let res: Response;
  try {
    res = await fetch(joinUrl(NODE_API_URL, path), { signal, cache: 'no-store' });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new ApiError('network', `Request to ${path} failed`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError('http', `${path} answered ${res.status}`, res.status);
  const text = await res.text();
  let body: Json;
  try {
    body = parseJson(text);
  } catch {
    throw new ApiError('shape', `${path} returned invalid JSON`);
  }
  // Absence is a 404; a successful null is a malformed answer.
  if (body === null) throw new ApiError('shape', `${path} returned null`);
  return body;
}

async function expect(path: string, opts?: RequestOptions): Promise<Json> {
  const body = await request(path, opts);
  if (body === null) throw new ApiError('http', `${path} answered 404`, 404);
  return body;
}

function guard<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    if (e instanceof ShapeError) throw new ApiError('shape', e.message);
    throw e;
  }
}

const orNull = <T>(body: Json | null, f: (b: Json) => T): T | null => (body === null ? null : guard(() => f(body)));

export const HOLDER_PAGE_SIZE = 100;

export const api = {
  getBlocks: async (offset: number, limit: number, opts?: RequestOptions): Promise<Block[]> => {
    const body = await expect(nodePaths.blocks(offset, limit), opts);
    return guard(() => asBlocks(body));
  },

  getNodes: async (opts?: RequestOptions): Promise<Node[]> => {
    const body = await expect(nodePaths.nodes(), opts);
    return guard(() => asNodes(body));
  },

  // Accepts a 32-byte hash (hex or base58) or a skip id such as `skip-12`.
  getBlock: async (id: string, opts?: RequestOptions): Promise<Block | null> => {
    const key = normalizeHash(id) ?? (/^skip-\d+$/.test(id) ? id : null);
    if (key === null) return null;
    return orNull(await request(nodePaths.block(key), opts), (b) => asBlock(b));
  },

  getBlockBySlot: async (slot: string | number, opts?: RequestOptions): Promise<Block | null> => {
    const key = normalizeSlot(String(slot));
    if (key === null) return null;
    return orNull(await request(nodePaths.blockBySlot(key), opts), (b) => asBlock(b));
  },

  // A pure integer id is a slot; anything else is a block hash.
  getBlockById: (id: string, opts?: RequestOptions): Promise<Block | null> =>
    /^\d+$/.test(id) ? api.getBlockBySlot(id, opts) : api.getBlock(id, opts),

  getTransaction: async (hash: string, opts?: RequestOptions): Promise<TransactionDetails | null> => {
    const key = normalizeHash(hash);
    if (key === null) return null;
    return orNull(await request(nodePaths.transaction(key), opts), asTransaction);
  },

  getAccount: async (pubkey: string, opts?: RequestOptions): Promise<AccountDetails | null> => {
    const key = normalizeHash(pubkey);
    if (key === null) return null;
    return orNull(await request(nodePaths.account(key), opts), asAccount);
  },

  getToken: async (id: string, opts?: RequestOptions): Promise<TokenSummary | null> => {
    const key = normalizeTokenId(id);
    if (key === null) return null;
    return orNull(await request(nodePaths.token(key), opts), (b) => asToken(b));
  },

  getTokens: async (opts?: RequestOptions): Promise<TokenSummary[]> => {
    const body = await expect(nodePaths.tokens(), opts);
    return guard(() => asTokens(body));
  },

  getTokenHolders: async (
    id: string,
    offset = 0,
    limit = HOLDER_PAGE_SIZE,
    opts?: RequestOptions,
  ): Promise<HolderPage | null> => {
    const key = normalizeTokenId(id);
    if (key === null) return null;
    return orNull(await request(nodePaths.tokenHolders(key, offset, limit), opts), asHolderPage);
  },

  search: (raw: string): Promise<SearchMatch[]> =>
    resolveSearch(raw, {
      transaction: (h) => api.getTransaction(h),
      block: (h) => api.getBlock(h),
      blockBySlot: (s) => api.getBlockBySlot(s),
      token: (t) => api.getToken(t),
      account: (h) => api.getAccount(h),
    }),
};
