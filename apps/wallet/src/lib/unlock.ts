import type { Keypair } from './keys.ts';
import type { KeystoreRecord } from './keystore.ts';

/** Completes an unlock begun earlier; false when it went stale and its key was zeroed. `current` reads staleness. */
export type FinishUnlock = ((keypair: Keypair, record: KeystoreRecord) => boolean) & { current: () => boolean };

/** Unlocks that finish after an erase, lock, wallet replacement or unmount must not become a session. */
export class UnlockGate {
  #generation = 0;

  invalidate(): void {
    this.#generation++;
  }

  /** The returned check turns false once anything invalidated the gate after this attempt began. */
  begin(): () => boolean {
    const generation = this.#generation;
    return () => generation === this.#generation;
  }
}

/** Hands the keypair on only for a current attempt; a stale one has its key zeroed instead. */
export function settleUnlock(current: boolean, keypair: Keypair, accept: (keypair: Keypair) => void): boolean {
  if (!current) {
    keypair.privateKey.fill(0);
    return false;
  }
  accept(keypair);
  return true;
}
