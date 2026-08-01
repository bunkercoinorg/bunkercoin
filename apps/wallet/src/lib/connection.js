const DEFAULT_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.bunkercoin.com/';

// Radio finality: seconds on a healthy HF link, minutes through band fades.
export const CONFIRM_POLL_MS = 5_000;
export const CONFIRM_TIMEOUT_MS = 15 * 60_000;

export class RpcError extends Error {
  constructor(method, code, message) {
    super(`${method}: ${message}`);
    this.code = code;
  }
}

export class BunkerConnection {
  constructor(url = DEFAULT_RPC) {
    this.url = url;
    this.id = 0;
  }

  async rpc(method, params = []) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }),
    });
    if (!res.ok) throw new RpcError(method, res.status, `HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new RpcError(method, body.error.code, body.error.message);
    return body.result;
  }

  async getBalance(address) {
    return (await this.rpc('getBalance', [address])).value ?? 0;
  }

  /** null for accounts the chain has never seen. */
  async getAccountInfo(address) {
    const result = await this.rpc('getAccountInfo', [address]);
    return result?.value !== undefined ? result.value : result;
  }

  async getNonce(address) {
    return (await this.getAccountInfo(address))?.data?.nonce ?? 0;
  }

  async getTokenBalances(address) {
    const result = await this.rpc('getTokenAccountsByOwner', [address]);
    return result?.value ?? result ?? [];
  }

  async getToken(tokenId) {
    return this.rpc('getToken', [tokenId]);
  }

  async getFee() {
    return (await this.rpc('getFeeForMessage', [null])).value;
  }

  async getSlot() {
    return this.rpc('getSlot');
  }

  /** tx object -> base58 id. Node accepts base64-encoded JSON. */
  async sendTransaction(tx) {
    const b64 = btoa(JSON.stringify(tx));
    return this.rpc('sendTransaction', [b64]);
  }

  async requestAirdrop(address, amount) {
    return this.rpc('requestAirdrop', [address, amount]);
  }

  async getSignatureStatus(txId) {
    const { value } = await this.rpc('getSignatureStatuses', [[txId]]);
    return value?.[0] ?? null;
  }

  /**
   * Polls patiently until finalized. onStatus fires on every poll so the UI
   * can show elapsed time instead of a dead spinner.
   */
  async confirm(txId, { pollMs = CONFIRM_POLL_MS, timeoutMs = CONFIRM_TIMEOUT_MS, onStatus, signal } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error('confirmation cancelled');
      let status = null;
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
