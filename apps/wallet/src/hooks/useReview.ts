import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignedTransaction } from '@/lib/keys';
import { BroadcastUncertainError, SendBlockedError, type NoncePlan, type Submission } from '@/lib/submit';
import type { WalletActions, WalletState } from '@/components/Dashboard';
import type { Broadcast } from '@/components/Outcome';

export interface ReviewedFee {
  fee: bigint;
  at: number;
  /** Set when the sign-time fetch returned a different fee: the receipt shows it and asks for a second look. */
  was: bigint | null;
}

export class NonceMovedError extends Error {}

export type SignResult = { kind: 'broadcast'; sent: Broadcast } | { kind: 'rejected'; reason: string } | { kind: 'stopped'; message: string };

/** The receipt's frozen fee and nonce, and the sign step that refuses to sign anything other than what was reviewed. */
export function useReview(state: WalletState, actions: WalletActions, fee: bigint | null) {
  const [reviewed, setReviewed] = useState<ReviewedFee | null>(null);
  const [plan, setPlan] = useState<NoncePlan | null>(null);
  const [planError, setPlanError] = useState('');
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const loadPlan = useCallback(() => {
    setPlanError('');
    actions.previewNonce().then(
      (p) => live.current && setPlan(p),
      (e: Error) => live.current && setPlanError(e.message),
    );
  }, [actions]);

  const open = useCallback(() => {
    if (fee === null) return false;
    setReviewed({ fee, at: state.fresh.fee.okAt ?? Date.now(), was: null });
    setPlan(null);
    loadPlan();
    return true;
  }, [fee, state.fresh.fee.okAt, loadPlan]);

  const sign = useCallback(
    async (build: (nonce: bigint, fee: bigint) => SignedTransaction, info: Submission): Promise<SignResult> => {
      if (!reviewed || !plan) return { kind: 'stopped', message: 'The review is not ready yet.' };
      let current: bigint;
      try {
        current = await state.conn.getFee();
      } catch (e) {
        return { kind: 'stopped', message: `Fee unavailable: ${(e as Error).message}` };
      }
      if (current !== reviewed.fee) {
        setReviewed({ fee: current, at: Date.now(), was: reviewed.fee });
        return { kind: 'stopped', message: '' };
      }
      const reviewedNonce = plan.nonce;
      let signedMs = 0;
      let signedAt = 0;
      try {
        const { txId, tracked } = await actions.submit((nonce) => {
          if (nonce !== reviewedNonce) throw new NonceMovedError(`The nonce moved to ${nonce} since review. Review again.`);
          const t0 = performance.now();
          const tx = build(nonce, current);
          signedMs = performance.now() - t0;
          signedAt = performance.now();
          return tx;
        }, { ...info, fee: current });
        return { kind: 'broadcast', sent: { txId, tracked, signedMs, acceptedMs: performance.now() - signedAt, acceptedAt: Date.now() } };
      } catch (e) {
        if (e instanceof BroadcastUncertainError) {
          return { kind: 'broadcast', sent: { txId: e.txId, tracked: true, signedMs, acceptedMs: 0, acceptedAt: Date.now() } };
        }
        if (e instanceof SendBlockedError || e instanceof NonceMovedError) {
          loadPlan();
          return { kind: 'stopped', message: e.message };
        }
        // Nothing was signed (lock, storage) or the node refused it outright.
        if (signedAt === 0) return { kind: 'stopped', message: (e as Error).message };
        return { kind: 'rejected', reason: (e as Error).message };
      }
    },
    [reviewed, plan, state.conn, actions, loadPlan],
  );

  return { reviewed, plan, planError, open, sign, loadPlan, close: () => setReviewed(null) };
}
