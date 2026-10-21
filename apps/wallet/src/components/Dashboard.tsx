'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BunkerConnection,
  ConfirmCancelledError,
  ConfirmTimeoutError,
  RpcError,
  TxFailedError,
  type AccountHistory,
  type TokenBalance,
} from '@/lib/connection';
import { addressToHex, type SignedTransaction } from '@/lib/keys';
import { addEntry, loadPending, mutatePending, patchEntry, removeEntry, type PendingTx } from '@/lib/pending';
import { nextNonce, withAccountLock } from '@/lib/submit';
import { elapsedLabel } from '@/lib/format';
import type { Signer } from '@/lib/signer';
import BalanceCard from '@/components/BalanceCard';
import Faucet from '@/components/Faucet';
import Send from '@/components/Send';
import CreateToken from '@/components/CreateToken';
import Activity from '@/components/Activity';
import RecoveryPhrase from '@/components/RecoveryPhrase';
import DangerZone from '@/components/DangerZone';
import { Button } from '@/components/ui';

const BALANCE_POLL_MS = 20_000;
// After the confirmation window an answer can still come; keep asking, just less often.
const SLOW_POLL_MS = 60_000;

export type Submission = Pick<PendingTx, 'kind' | 'amount' | 'to' | 'ticker'>;

export interface SubmitResult {
  txId: string;
  /** False when the broadcast succeeded but tracking could not be persisted. */
  tracked: boolean;
}

/** Signs with the next reconciled nonce and broadcasts, one submission per account at a time. */
export type SubmitSigned = (build: (nonce: bigint) => SignedTransaction, info: Submission) => Promise<SubmitResult>;

export type RecordSubmitted = (txId: string, info: Submission) => SubmitResult;

type Resource = 'balance' | 'tokens' | 'slot' | 'history' | 'fee';

interface DashboardProps {
  signer: Signer;
  onLock: () => void;
  onWalletRemoved: () => void;
}

export default function Dashboard({ signer, onLock, onWalletRemoved }: DashboardProps) {
  const conn = useRef(new BunkerConnection()).current;
  const chain = conn.url;
  const address = signer.address;
  const meHex = useMemo(() => addressToHex(address), [address]);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [fee, setFee] = useState<bigint | null>(null);
  const [feeError, setFeeError] = useState('');
  const [pending, setPending] = useState<PendingTx[]>(() => loadPending(chain, address));
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [trackingLost, setTrackingLost] = useState(false);
  const [history, setHistory] = useState<AccountHistory | null>(null);
  const [slot, setSlot] = useState<bigint | null>(null);
  const [health, setHealth] = useState<{ okAt: number | null; failing: boolean }>({ okAt: null, failing: false });
  const latest = useRef<Partial<Record<Resource, number>>>({});
  const trackers = useRef<AbortController | null>(null);
  const [, tick] = useState(0);

  const apply = useCallback(
    (op: (list: PendingTx[]) => PendingTx[]) => {
      setPending(op);
      if (!mutatePending(chain, address, op)) setTrackingLost(true);
    },
    [chain, address],
  );

  // Only the newest request per resource may write state; slower, older answers are dropped.
  const load = useCallback(
    <T,>(name: Resource, fetch: () => Promise<T>, onValue: (v: T) => void, onError?: (e: Error) => void) => {
      const id = (latest.current[name] ?? 0) + 1;
      latest.current[name] = id;
      return fetch().then(
        (v) => {
          if (latest.current[name] === id) onValue(v);
        },
        (e: Error) => {
          if (latest.current[name] === id) onError?.(e);
        },
      );
    },
    [],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      load(
        'balance',
        () => conn.getBalance(address),
        (v) => {
          setBalance(v);
          setHealth({ okAt: Date.now(), failing: false });
        },
        () => setHealth((h) => ({ ...h, failing: true })),
      ),
      load('tokens', () => conn.getTokenBalances(address), setTokens),
      load('slot', () => conn.getSlot(), setSlot),
      load(
        'fee',
        () => conn.getFee(),
        (v) => {
          setFee(v);
          setFeeError('');
        },
        (e) => {
          // A transient outage keeps the last fee; a refused one must not stay signable.
          if (e instanceof RpcError && e.kind !== 'protocol') return;
          setFee(null);
          setFeeError(e.message);
        },
      ),
      load('history', () => conn.getAccountHistory(meHex), setHistory),
    ]);
  }, [conn, address, meHex, load]);

  useEffect(() => {
    void refresh();
    const poll = setInterval(refresh, BALANCE_POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh]);

  const track = useCallback(
    async (entry: PendingTx, signal: AbortSignal) => {
      let slow = entry.state === 'unconfirmed';
      for (;;) {
        try {
          await conn.confirm(entry.txId, slow ? { signal, pollMs: SLOW_POLL_MS, timeoutMs: Infinity } : { signal });
          apply(removeEntry(entry.txId));
          void refresh();
          return;
        } catch (e) {
          if (e instanceof ConfirmCancelledError) return;
          if (e instanceof ConfirmTimeoutError) {
            apply(patchEntry(entry.txId, { state: 'unconfirmed' }));
            slow = true;
            continue;
          }
          apply(patchEntry(entry.txId, { state: 'failed', error: (e as Error).message }));
          if (e instanceof TxFailedError) void refresh();
          return;
        }
      }
    },
    [conn, apply, refresh],
  );

  // Resume confirmation polling for every open tx (incl. after reload); everything stops on unmount.
  useEffect(() => {
    const ctrl = new AbortController();
    trackers.current = ctrl;
    for (const entry of loadPending(chain, address)) {
      if (entry.state !== 'failed') void track(entry, ctrl.signal);
    }
    return () => {
      ctrl.abort();
      trackers.current = null;
    };
  }, [chain, address, track]);

  const record = useCallback(
    (txId: string, info: Submission, nonce: bigint | null): SubmitResult => {
      const entry: PendingTx = { ...info, txId, nonce, at: Date.now(), state: 'pending' };
      setPending(addEntry(entry));
      const tracked = mutatePending(chain, address, addEntry(entry));
      if (!tracked) setTrackingLost(true);
      if (trackers.current) void track(entry, trackers.current.signal);
      return { txId, tracked };
    },
    [chain, address, track],
  );

  const recordSubmitted: RecordSubmitted = useCallback((txId, info) => record(txId, info, null), [record]);

  const submitSigned: SubmitSigned = useCallback(
    (build, info) =>
      withAccountLock(address, async () => {
        signer.assertActive();
        const outstanding = [...pendingRef.current, ...loadPending(chain, address)]
          .filter((p) => p.nonce !== null && p.state !== 'failed')
          .map((p) => ({ txId: p.txId, nonce: p.nonce as bigint }));
        const nonce = await nextNonce(conn, address, outstanding);
        signer.assertActive();
        const tx = build(nonce);
        let txId: string;
        try {
          txId = await conn.sendTransaction(tx);
        } catch (e) {
          if (e instanceof RpcError && (e.kind === 'timeout' || e.kind === 'network')) {
            throw new Error(
              'No answer from the node. The transaction may still have been broadcast; check Activity before sending again.',
            );
          }
          throw e;
        }
        return record(txId, info, nonce);
      }),
    [address, chain, conn, signer, record],
  );

  const status = health.failing ? (health.okAt === null ? 'offline' : 'stale') : health.okAt === null ? 'connecting' : 'live';
  const statusLabel =
    status === 'stale' && health.okAt !== null
      ? `offline · updated ${elapsedLabel(health.okAt)} ago`
      : status === 'connecting'
        ? 'connecting…'
        : status;

  return (
    <>
      <div className="mb-3.5 flex items-center gap-2">
        <span
          className="flex items-center gap-[7px] font-mono text-[11px] tracking-[0.12em] uppercase text-muted"
          title={slot === null ? undefined : `chain slot ${slot}`}
          role="status"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'live'
                ? 'bg-accent shadow-[0_0_8px_rgba(0,255,178,0.22)]'
                : status === 'connecting'
                  ? 'bg-amber'
                  : 'bg-danger'
            }`}
          />
          {statusLabel}
        </span>
        <span className="flex-1" />
        <Button variant="ghost" small onClick={onLock}>
          Lock
        </Button>
      </div>

      <BalanceCard address={address} balance={balance} tokens={tokens} />
      <Faucet conn={conn} address={address} onSubmitted={recordSubmitted} />
      <Send signer={signer} balance={balance} tokens={tokens} fee={fee} feeError={feeError} submit={submitSigned} />
      <CreateToken conn={conn} balance={balance} fee={fee} feeError={feeError} signer={signer} submit={submitSigned} />
      <Activity
        addressHex={meHex}
        pending={pending}
        history={history}
        tokens={tokens}
        trackingLost={trackingLost}
        onDismiss={(txId) => apply(removeEntry(txId))}
      />
      <RecoveryPhrase />
      <DangerZone onWalletRemoved={onWalletRemoved} />
    </>
  );
}
