import type { Keypair } from './keys.ts';
import { KeystoreError, type KeystoreRecord } from './keystore.ts';

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

export const CHANGED_MEANWHILE = 'The wallet on this device changed meanwhile.';

const isMemory = (e: unknown) => e instanceof RangeError || /out of memory|memory access|allocat|Memory\.grow/i.test(String((e as Error)?.message));

/** The W08 copy for a failed unlock or reveal. */
export function unlockErrorCopy(e: unknown): string {
  const message = (e as Error)?.message ?? '';
  if (message === 'Incorrect password') return 'Wrong password.';
  if (e instanceof KeystoreError) {
    if (e.status === 'unavailable') return 'This browser blocked storage.';
    if (e.status === 'absent') return 'No saved wallet in this browser.';
    return 'Saved wallet is damaged. Import with your 24 words.';
  }
  if (isMemory(e)) return 'Out of memory. Close other tabs and retry.';
  // A record that decrypts to something other than a valid phrase is damaged, not a wrong password.
  if (message === 'Invalid recovery phrase') return 'Saved wallet is damaged. Import with your 24 words.';
  if (e instanceof DOMException && e.name === 'SecurityError') return 'This browser blocked storage.';
  return message || 'Unlock failed.';
}

/** The W05 copy for a failed setup; storage failures say nothing was saved. */
export function setupErrorCopy(e: unknown): string {
  if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'SecurityError')) {
    return 'Storage is full or blocked. Nothing was saved.';
  }
  if (e instanceof KeystoreError && e.status === 'unavailable') return 'Storage is full or blocked. Nothing was saved.';
  if (isMemory(e)) return 'Out of memory. Close other tabs and retry.';
  return (e as Error)?.message || 'Setup failed. Nothing was saved.';
}
