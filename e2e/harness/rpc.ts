import { LIVE } from './target';

export const FEE_UNITS = 100;
export const UNITS_PER_BUNKER = 1_000_000;
// The live testnet finalizes a block every 3-7 min over radio.
export const FINALITY_MS = (LIVE ? 20 : 5) * 60_000;
const STATUS_POLL_MS = LIVE ? 5_000 : 1_000;

/** Mirrors the wallet's display format so UI text can be asserted from base units. */
export function formatBunker(units: number): string {
  const whole = Math.floor(units / UNITS_PER_BUNKER).toLocaleString('en-US');
  return `${whole}.${String(units % UNITS_PER_BUNKER).padStart(6, '0')}`;
}

export interface TokenHolding {
  ticker?: string;
  tokenId?: string | number;
  amount?: number;
  balance?: number;
}

/** Direct JSON-RPC client: the oracle the UI is checked against. */
export class Rpc {
  private id = 0;

  constructor(readonly url: string) {}

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }),
    });
    const body = (await res.json()) as { result?: T; error?: { code: number; message: string } };
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result as T;
  }

  async getSlot(): Promise<number> {
    return this.call<number>('getSlot');
  }

  async getBalance(address: string): Promise<number> {
    return (await this.call<{ value: number }>('getBalance', [address])).value;
  }

  /** Executed nonce: how many of the account's transactions the chain has applied. */
  async getNonce(address: string): Promise<number> {
    const { value } = await this.call<{ value: { data: { nonce: number } } | null }>('getAccountInfo', [address]);
    return value?.data.nonce ?? 0;
  }

  async getTokens(address: string): Promise<TokenHolding[]> {
    const { value } = await this.call<{ value: { tokens?: TokenHolding[] } | TokenHolding[] }>(
      'getTokenAccountsByOwner',
      [address],
    );
    return Array.isArray(value) ? value : (value?.tokens ?? []);
  }

  async tokenAmount(address: string, ticker: string): Promise<number> {
    const t = (await this.getTokens(address)).find((h) => h.ticker === ticker);
    return t?.amount ?? t?.balance ?? 0;
  }

  async waitFinalized(txId: string, timeoutMs = FINALITY_MS): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { value } = await this.call<{
        value: ({ confirmationStatus: string; err: unknown } | null)[];
      }>('getSignatureStatuses', [[txId]]);
      const status = value[0];
      if (status?.err) throw new Error(`${txId} failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === 'finalized') return;
      await new Promise((r) => setTimeout(r, STATUS_POLL_MS));
    }
    throw new Error(`${txId} not finalized within ${timeoutMs}ms`);
  }

  /** Genesis-signed airdrop; the node reuses the finalized nonce, so callers must not overlap these. */
  async fund(address: string, units: number): Promise<void> {
    await this.waitFinalized(await this.call<string>('requestAirdrop', [address, units]));
  }
}
