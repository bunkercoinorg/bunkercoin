'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BunkerConnection,
  ConfirmCancelledError,
  ConfirmTimeoutError,
  RpcError,
  TxFailedError,
  type AccountHistory,
  type SignatureStatus,
  type TokenBalance,
} from '@/lib/connection';
import { addressToHex, type SignedTransaction } from '@/lib/keys';
import {
  addEntry,
  loadPending,
  loadReservations,
  migrateLegacyPending,
  mutatePending,
  mutateReservations,
  patchEntry,
  releaseReservations,
  removeEntry,
  transitionEntry,
  type PendingTx,
  type Reservation,
} from '@/lib/pending';
import { resendUncertain, submitTransaction, withAccountLock, type Account, type Submission } from '@/lib/submit';
import { connectionStatus, initialFreshness, type Freshness, type FreshnessMap, type Resource } from '@/lib/freshness';
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

export type { Submission };

export interface SubmitResult {
  txId: string;
  /** False when the broadcast succeeded but tracking could not be persisted. */
  tracked: boolean;
}

/** Signs with the next reconciled nonce and broadcasts, one per account at a time; refuses while one is unacknowledged. */
export type SubmitSigned = (build: (nonce: bigint) => SignedTransaction, info: Submission) => Promise<SubmitResult>;

export type RecordSubmitted = (txId: string, info: Submission) => Promise<SubmitResult>;

interface DashboardProps {
  signer: Signer;
  onLock: () => void;
  onWalletRemoved: () => void;
}

const noteUncertain = (txId: string, error: string) => (list: PendingTx[]) =>
  list.map((p) => (p.txId === txId && p.state === 'uncertain' ? { ...p, error } : p));

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
  const [trackingLost, setTrackingLost] = useState(false);
  const [history, setHistory] = useState<AccountHistory | null>(null);
  const [slot, setSlot] = useState<bigint | null>(null);
  const [fresh, setFresh] = useState<FreshnessMap>(initialFreshness);
  const latest = useRef<Partial<Record<Resource, number>>>({});
  // Aborted on unmount: in-flight refreshes and every tracker stop with it.
  const life = useRef<AbortController | null>(null);
  const trackers = useRef(new Map<string, AbortController>());
  // Reservations that could not be persisted still hold their nonce for this tab's lifetime.
  const unsavedReservations = useRef<Reservation[]>([]);
  const [, tick] = useState(0);

  const apply = useCallback(
    (op: (list: PendingTx[]) => PendingTx[]) => {
      setPending(op);
      return mutatePending(chain, address, op).then((ok) => {
        if (!ok) setTrackingLost(true);
        return ok;
      });
    },
    [chain, address],
  );

  const reserve = useCallback(
    async (op: (list: Reservation[]) => Reservation[]) => {
      const ok = await mutateReservations(chain, address, op);
      const unsaved = unsavedReservations.current;
      unsavedReservations.current = ok ? unsaved.filter((r) => op([r]).some((x) => x.txId === r.txId)) : op(unsaved);
      return ok;
    },
    [chain, address],
  );

  // Only the newest request per resource may write state; slower, older answers are dropped.
  const load = useCallback(<T,>(name: Resource, fetch: (signal: AbortSignal) => Promise<T>, onValue: (v: T) => void) => {
    const signal = life.current?.signal;
    if (!signal || signal.aborted) return Promise.resolve();
    const id = (latest.current[name] ?? 0) + 1;
    latest.current[name] = id;
    const mark = (f: Freshness | ((prev: Freshness) => Freshness)) =>
      setFresh((m) => ({ ...m, [name]: typeof f === 'function' ? f(m[name]) : f }));
    return fetch(signal).then(
      (v) => {
        if (latest.current[name] !== id || signal.aborted) return;
        onValue(v);
        mark({ okAt: Date.now(), error: null });
      },
      (e: Error) => {
        if (latest.current[name] !== id || signal.aborted) return;
        mark((prev) => ({ ...prev, error: e.message }));
        if (name !== 'fee') return;
        // A transient outage keeps the last fee; a refused one must not stay signable.
        if (e instanceof RpcError && e.kind !== 'protocol') return;
        setFee(null);
        setFeeError(e.message);
      },
    );
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      load('balance', (signal) => conn.getBalance(address, { signal }), setBalance),
      load('tokens', (signal) => conn.getTokenBalances(address, { signal }), setTokens),
      load('slot', (signal) => conn.getSlot({ signal }), setSlot),
      load(
        'fee',
        (signal) => conn.getFee({ signal }),
        (v) => {
          setFee(v);
          setFeeError('');
        },
      ),
      load('history', (signal) => conn.getAccountHistory(meHex, { signal }), setHistory),
    ]);
  }, [conn, address, meHex, load]);

  const track = useCallback(
    async (entry: PendingTx, signal: AbortSignal) => {
      let slow = entry.state === 'unconfirmed';
      let seen = false;
      const release = () => void reserve(releaseReservations([entry.txId]));
      // Seen by the node: no longer "no answer". Its reservation stays uncertain until it settles.
      const onStatus = (status: SignatureStatus | null) => {
        if (seen || status === null || status.err !== null) return;
        seen = true;
        void apply(transitionEntry(entry.txId, 'uncertain', 'pending'));
      };
      for (;;) {
        try {
          await conn.confirm(
            entry.txId,
            slow ? { signal, onStatus, pollMs: SLOW_POLL_MS, timeoutMs: Infinity } : { signal, onStatus },
          );
          void apply(removeEntry(entry.txId));
          release();
          void refresh();
          return;
        } catch (e) {
          if (e instanceof ConfirmCancelledError) return;
          if (e instanceof ConfirmTimeoutError) {
            void apply(transitionEntry(entry.txId, 'pending', 'unconfirmed'));
            slow = true;
            continue;
          }
          void apply(patchEntry(entry.txId, { state: 'failed', error: (e as Error).message }));
          if (e instanceof TxFailedError) {
            release();
            void refresh();
          }
          return;
        }
      }
    },
    [conn, apply, reserve, refresh],
  );

  const stopTracking = useCallback((txId: string) => {
    trackers.current.get(txId)?.abort();
    trackers.current.delete(txId);
  }, []);

  const startTracking = useCallback(
    (entry: PendingTx) => {
      const root = life.current;
      if (!root || root.signal.aborted || trackers.current.has(entry.txId)) return;
      const ctrl = new AbortController();
      root.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
      trackers.current.set(entry.txId, ctrl);
      void track(entry, ctrl.signal).finally(() => {
        if (trackers.current.get(entry.txId) === ctrl) trackers.current.delete(entry.txId);
      });
    },
    [track],
  );

  // Polling, the legacy migration and confirmation tracking for every open tx (incl. after reload).
  useEffect(() => {
    const ctrl = new AbortController();
    life.current = ctrl;
    const map = trackers.current;
    void refresh();
    const poll = setInterval(refresh, BALANCE_POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    void migrateLegacyPending(chain, address).then(() => {
      if (ctrl.signal.aborted) return;
      const list = loadPending(chain, address);
      setPending((prev) => [...prev.filter((p) => !list.some((l) => l.txId === p.txId)), ...list]);
      list.filter((p) => p.state !== 'failed').forEach(startTracking);
    });
    return () => {
      ctrl.abort();
      map.clear();
      life.current = null;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [chain, address, refresh, startTracking]);

  const recordSubmitted: RecordSubmitted = useCallback(
    async (txId, info) => {
      const entry: PendingTx = { ...info, txId, nonce: null, at: Date.now(), state: 'pending' };
      const tracked = await apply(addEntry(entry));
      startTracking(entry);
      return { txId, tracked };
    },
    [apply, startTracking],
  );

  const account: Account = useMemo(
    () => ({
      conn,
      address,
      reservations: () => [...loadReservations(chain, address), ...unsavedReservations.current],
      entries: () => loadPending(chain, address),
      reserve,
      apply,
      track: startTracking,
      untrack: stopTracking,
    }),
    [conn, address, chain, reserve, apply, startTracking, stopTracking],
  );

  const submitSigned: SubmitSigned = useCallback(
    (build, info) =>
      withAccountLock(address, () => {
        signer.assertActive();
        return submitTransaction(
          account,
          (nonce) => {
            signer.assertActive();
            return build(nonce);
          },
          info,
        );
      }),
    [address, signer, account],
  );

  const resend = useCallback(
    (txId: string) =>
      void withAccountLock(address, () => resendUncertain(account, txId)).then(
        (note) => (note === null ? undefined : apply(noteUncertain(txId, note))),
        (e: Error) => apply(noteUncertain(txId, e.message)),
      ),
    [address, account, apply],
  );

  const dismiss = useCallback(
    (txId: string) => {
      stopTracking(txId);
      void apply(removeEntry(txId));
    },
    [apply, stopTracking],
  );

  const { status, failing } = connectionStatus(fresh);
  const balanceOkAt = fresh.balance.okAt;
  const statusLabel =
    status === 'stale' && balanceOkAt !== null
      ? `offline · updated ${elapsedLabel(balanceOkAt)} ago`
      : status === 'connecting'
        ? 'connecting…'
        : status === 'partial'
          ? `live · ${failing.join(', ')} unavailable`
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
                : status === 'connecting' || status === 'partial'
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
        historyError={fresh.history.error}
        tokens={tokens}
        trackingLost={trackingLost}
        onDismiss={dismiss}
        onResend={resend}
      />
      <RecoveryPhrase />
      <DangerZone onWalletRemoved={onWalletRemoved} />
    </>
  );
}
