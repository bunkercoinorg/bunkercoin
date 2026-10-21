import type { Keypair } from './keys.ts';

export class WalletLockedError extends Error {
  constructor() {
    super('The wallet was locked; nothing was signed.');
  }
}

/** Owns the private key buffer; once revoked it is zeroed and every further use throws. */
export class Signer {
  readonly address: string;
  readonly publicKey: Uint8Array;
  #privateKey: Uint8Array | null;

  constructor(keypair: Keypair) {
    this.address = keypair.address;
    this.publicKey = keypair.publicKey;
    this.#privateKey = keypair.privateKey;
  }

  get active(): boolean {
    return this.#privateKey !== null;
  }

  /** Call after every await in a signing flow: a lock in between must abort it. */
  assertActive(): void {
    if (!this.#privateKey) throw new WalletLockedError();
  }

  /** Synchronous on purpose: the key cannot be revoked while `fn` runs. */
  use<T>(fn: (privateKey: Uint8Array, publicKey: Uint8Array) => T): T {
    if (!this.#privateKey) throw new WalletLockedError();
    return fn(this.#privateKey, this.publicKey);
  }

  revoke(): void {
    this.#privateKey?.fill(0);
    this.#privateKey = null;
  }
}
