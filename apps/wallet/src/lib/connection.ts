import type { SignedTransaction } from './keys';

const DEFAULT_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.bunkercoin.com/';

// Radio finality: seconds on a healthy HF link, minutes through band fades.
export const CONFIRM_POLL_MS = 5_000;
export const CONFIRM_TIMEOUT_MS = 15 * 60_000;

export interface AccountInfo {
  lamports: number;
  data?: { nonce?: number; tokenBalances?: unknown };
}

export interface TokenBalance {
  ticker?: string;
  tokenId?: number;
  token_id?: number;
  amount?: number;
  balance?: number;
}

export interface SignatureStatus {
  slot: number;
  confirmations: number | null;
  confirmationStatus: 'processed' | 'finalized';
  err: unknown;
}

export interface ChainTransaction {
  hash: string;
  sender: string;
  nonce: number;
  fee: number;
  slot: number;
  block_hash: string;
  body?: { type?: string; to?: string; amount?: number };
  status?: { success?: boolean; error?: string | null };
}

export interface ConfirmOptions {
  pollMs?: number;
  timeoutMs?: number;
  onStatus?: (status: SignatureStatus | null) => void;
  signal?: AbortSignal;
}

export class RpcError extends Error {
  code: number;
  constructor(method: string, code: number, message: string) {
    super(`${method}: ${message}`);
    this.code = code;
  }
}

interface RpcResponse<T> {
  context?: { slot: number };
  value: T;
}

export class BunkerConnection {
  private url: string;
  private id = 0;

  constructor(url: string = DEFAULT_RPC) {
    this.url = url;
  }

  async rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }),
    });
    if (!res.ok) throw new RpcError(method, res.status, `HTTP ${res.status}`);
    const body = (await res.json()) as { result?: T; error?: { code: number; message: string } };
    if (body.error) throw new RpcError(method, body.error.code, body.error.message);
    return body.result as T;
  }

  async getBalance(address: string): Promise<number> {
    return (await this.rpc<RpcResponse<number>>('getBalance', [address])).value ?? 0;
  }

  /** null for accounts the chain has never seen. */
  async getAccountInfo(address: string): Promise<AccountInfo | null> {
    const result = await this.rpc<RpcResponse<AccountInfo | null> | AccountInfo | null>('getAccountInfo', [
      address,
    ]);
    if (result && typeof result === 'object' && 'value' in result) return result.value;
    return result as AccountInfo | null;
  }

  async getNonce(address: string): Promise<number> {
    return (await this.getAccountInfo(address))?.data?.nonce ?? 0;
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    const result = await this.rpc<RpcResponse<TokenBalance[]> | TokenBalance[] | null>(
      'getTokenAccountsByOwner',
      [address],
    );
    if (result && typeof result === 'object' && 'value' in result) return result.value ?? [];
    return (result as TokenBalance[]) ?? [];
  }

  async getFee(): Promise<number> {
    return (await this.rpc<RpcResponse<number>>('getFeeForMessage', [null])).value;
  }

  async getSlot(): Promise<number> {
    return this.rpc<number>('getSlot');
  }

  /** Global newest-first list — the node has no per-account filter yet. */
  async getTransactions(limit = 200, offset = 0): Promise<ChainTransaction[]> {
    const result = await this.rpc<{ transactions?: ChainTransaction[] }>('getTransactions', [limit, offset]);
    return result?.transactions ?? [];
  }

  /** tx object -> base58 id. Node accepts base64-encoded JSON. */
  async sendTransaction(tx: SignedTransaction): Promise<string> {
    const b64 = btoa(JSON.stringify(tx));
    return this.rpc<string>('sendTransaction', [b64]);
  }

  async requestAirdrop(address: string, amount: number): Promise<string> {
    return this.rpc<string>('requestAirdrop', [address, amount]);
  }

  async getSignatureStatus(txId: string): Promise<SignatureStatus | null> {
    const { value } = await this.rpc<RpcResponse<(SignatureStatus | null)[]>>('getSignatureStatuses', [
      [txId],
    ]);
    return value?.[0] ?? null;
  }

  /** Polls until finalized; onStatus fires each poll so the UI can show progress. */
  async confirm(
    txId: string,
    { pollMs = CONFIRM_POLL_MS, timeoutMs = CONFIRM_TIMEOUT_MS, onStatus, signal }: ConfirmOptions = {},
  ): Promise<SignatureStatus> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error('confirmation cancelled');
      let status: SignatureStatus | null = null;
      try {
        status = await this.getSignatureStatus(txId);
      } catch {
        // Transient RPC failures must not kill a confirmation that will land.
      }
      onStatus?.(status);
      if (status?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === 'finalized') return status;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error('Confirmation timed out — the transaction may still finalize later');
  }
}
