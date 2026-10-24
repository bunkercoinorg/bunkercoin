import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { base58ToBytes } from '@bunkercoin/chain-format';
import { ConfirmCancelledError, ConfirmTimeoutError, TxFailedError, type BunkerConnection, type SignatureStatus } from '@/lib/connection';
import { toHex } from '@/lib/keys';
import { blockIntervals, isInflight, phaseOf, settledText } from '@/lib/inflight';
import { notify } from '@/lib/notify';
import {
  addEntry,
  loadPending,
  loadReservations,
  migrateLegacyPending,
  mutatePending,
  mutateReservations,
  patchEntry,
  phaseEntry,
  releaseReservations,
  removeEntry,
  transitionEntry,
  type PendingTx,
  type Reservation,
} from '@/lib/pending';
import { promoteMetadata } from '@/lib/metadata';
import type { Account, Submission } from '@/lib/submit';

// After the confirmation window an answer can still come; keep asking, just less often.
const SLOW_POLL_MS = 60_000;
const PHASE_LOOKUP_MS = 15_000;
const CADENCE_POLL_MS = 2 * 60_000;

export interface Note {
  id: string;
  txId: string;
  tone: 'ok' | 'error';
  text: string;
}

/**
 * Confirmation tracking for one account. It needs no key, so it lives above the lock: transfers keep being followed,
 * and finalize into Activity, while the wallet is locked.
 */
export interface Inflight {
  conn: BunkerConnection;
  pending: PendingTx[];
  /** txId -> when this tab saw it finalize. */
  finalized: Map<string, number>;
  /** txId -> last status poll. */
  checkedAt: Map<string, number>;
  trackingLost: boolean;
  /** Observed gaps between recent finalized blocks, newest first. */
  intervals: number[];
  notes: Note[];
  dismissNote: (id: string) => void;
  account: Account | null;
  apply: (op: (list: PendingTx[]) => PendingTx[]) => Promise<boolean>;
  startTracking: (entry: PendingTx) => void;
  stopTracking: (txId: string) => void;
  record: (txId: string, info: Submission) => Promise<{ txId: string; tracked: boolean }>;
  promoteOnFinal: (txId: string, hash: string) => void;
  /** Set by the unlocked view so a settled transfer refreshes balances. */
  onSettled: MutableRefObject<(() => void) | null>;
}

export function useInflight(conn: BunkerConnection, address: string | null): Inflight {
  const chain = conn.url;
  const [pending, setPending] = useState<PendingTx[]>(() => (address ? loadPending(chain, address) : []));
  const [trackingLost, setTrackingLost] = useState(false);
  const [finalized, setFinalized] = useState<Map<string, number>>(() => new Map());
  const [checkedAt, setCheckedAt] = useState<Map<string, number>>(() => new Map());
  const [intervals, setIntervals] = useState<number[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  // Aborted when the account changes or the app unmounts: every tracker stops with it.
  const life = useRef<AbortController | null>(null);
  const trackers = useRef(new Map<string, AbortController>());
  const promotions = useRef(new Map<string, string>());
  // Reservations that could not be persisted still hold their nonce for this tab's lifetime.
  const unsavedReservations = useRef<Reservation[]>([]);
  const onSettled = useRef<(() => void) | null>(null);
  const openCount = useRef(0);
  openCount.current = pending.filter(isInflight).length;

  const apply = useCallback(
    (op: (list: PendingTx[]) => PendingTx[]) => {
      if (!address) return Promise.resolve(false);
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
      if (!address) return false;
      const ok = await mutateReservations(chain, address, op);
      const unsaved = unsavedReservations.current;
      unsavedReservations.current = ok ? unsaved.filter((r) => op([r]).some((x) => x.txId === r.txId)) : op(unsaved);
      return ok;
    },
    [chain, address],
  );

  const settled = useCallback((entry: PendingTx, error: string | null) => {
    const text = settledText(entry, error);
    setNotes((n) => [...n.filter((x) => x.txId !== entry.txId), { id: `${entry.txId}:${Date.now()}`, txId: entry.txId, tone: error === null ? 'ok' : 'error', text }]);
    notify(text);
    onSettled.current?.();
  }, []);

  const track = useCallback(
    async (entry: PendingTx, signal: AbortSignal) => {
      let slow = entry.state === 'unconfirmed';
      let seen = false;
      let phase = entry.phase;
      let lookedAt = 0;
      const hex = (() => {
        const raw = base58ToBytes(entry.txId);
        return raw ? toHex(raw) : null;
      })();
      const release = () => void reserve(releaseReservations([entry.txId]));
      const place = () => {
        if (hex === null || Date.now() - lookedAt < PHASE_LOOKUP_MS) return;
        lookedAt = Date.now();
        conn.getTransaction(hex, { signal }).then(
          (t) => {
            const next = phaseOf(null, t.location);
            if (next === null || next === phase || signal.aborted) return;
            phase = next;
            void apply(phaseEntry(entry.txId, next));
          },
          () => undefined,
        );
      };
      // Seen by the node: no longer "no answer". Its reservation stays uncertain until it settles.
      const onStatus = (status: SignatureStatus | null) => {
        setCheckedAt((m) => new Map(m).set(entry.txId, Date.now()));
        if (status === null || status.err !== null) return;
        place();
        if (seen) return;
        seen = true;
        void apply(transitionEntry(entry.txId, 'uncertain', 'pending'));
      };
      for (;;) {
        try {
          await conn.confirm(
            entry.txId,
            slow ? { signal, onStatus, pollMs: SLOW_POLL_MS, timeoutMs: Infinity } : { signal, onStatus },
          );
          setFinalized((m) => new Map(m).set(entry.txId, Date.now()));
          const hash = promotions.current.get(entry.txId);
          if (hash) {
            promotions.current.delete(entry.txId);
            void promoteMetadata(hash);
          }
          void apply(removeEntry(entry.txId));
          release();
          settled(entry, null);
          return;
        } catch (e) {
          if (e instanceof ConfirmCancelledError) return;
          if (e instanceof ConfirmTimeoutError) {
            void apply(transitionEntry(entry.txId, 'pending', 'unconfirmed'));
            slow = true;
            continue;
          }
          const message = (e as Error).message;
          void apply(patchEntry(entry.txId, { state: 'failed', error: message, ...(e instanceof TxFailedError ? { executed: true as const } : {}) }));
          if (e instanceof TxFailedError) release();
          settled(entry, message);
          return;
        }
      }
    },
    [conn, apply, reserve, settled],
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

  // The legacy migration, then tracking for every open tx (incl. after reload), and the block cadence while any is open.
  useEffect(() => {
    if (!address) return;
    const ctrl = new AbortController();
    life.current = ctrl;
    const map = trackers.current;
    setPending(loadPending(chain, address));
    const intervalsKnown = { current: false };
    const cadence = () => {
      if (openCount.current === 0 && intervalsKnown.current) return;
      conn.getBlockTimes(24, { signal: ctrl.signal }).then(
        (times) => {
          if (ctrl.signal.aborted) return;
          intervalsKnown.current = true;
          setIntervals(blockIntervals(times));
        },
        () => undefined,
      );
    };
    cadence();
    const poll = setInterval(() => document.visibilityState === 'visible' && cadence(), CADENCE_POLL_MS);
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
    };
  }, [conn, chain, address, startTracking]);

  const record = useCallback(
    async (txId: string, info: Submission) => {
      const entry: PendingTx = { ...info, txId, nonce: null, at: Date.now(), state: 'pending' };
      const tracked = await apply(addEntry(entry));
      startTracking(entry);
      return { txId, tracked };
    },
    [apply, startTracking],
  );

  const account: Account | null = useMemo(
    () =>
      address
        ? {
            conn,
            address,
            reservations: () => [...loadReservations(chain, address), ...unsavedReservations.current],
            entries: () => loadPending(chain, address),
            reserve,
            apply,
            track: startTracking,
            untrack: stopTracking,
          }
        : null,
    [conn, address, chain, reserve, apply, startTracking, stopTracking],
  );

  const promoteOnFinal = useCallback((txId: string, hash: string) => {
    promotions.current.set(txId, hash);
  }, []);

  const dismissNote = useCallback((id: string) => setNotes((n) => n.filter((x) => x.id !== id)), []);

  return {
    conn,
    pending: address ? pending : [],
    finalized,
    checkedAt,
    trackingLost,
    intervals,
    notes,
    dismissNote,
    account,
    apply,
    startTracking,
    stopTracking,
    record,
    promoteOnFinal,
    onSettled,
  };
}
