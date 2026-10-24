'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddressChip, AppShell, Banner, Button, Footer, Icon, StatusTag, Tag, TabBar, type NavItem } from '@bunkercoin/ui';
import { utcClock } from '@bunkercoin/chain-format';
import {
  RpcError,
  type AccountHistory,
  type BunkerConnection,
  type TokenBalance,
  type TokenMeta,
} from '@/lib/connection';
import { addressToHex, type SignedTransaction } from '@/lib/keys';
import { loadPending, removeEntry, type PendingTx } from '@/lib/pending';
import {
  collectOutstanding,
  nextNonce,
  resendUncertain,
  submitTransaction,
  withAccountLock,
  type NoncePlan,
  type Submission,
} from '@/lib/submit';
import { cadenceHint, fetchSnapshot, nativeSpendable, revalidate, spendableTokens, type Spendable } from '@/lib/inflight';
import { connectionStatus, initialFreshness, type Freshness, type FreshnessMap, type Resource } from '@/lib/freshness';
import type { Inflight } from '@/hooks/useInflight';
import type { Signer } from '@/lib/signer';
import type { AutoLockMinutes } from '@/lib/session';
import { useHashView, viewHref, type View } from '@/hooks/useHashView';
import Home from '@/components/Home';
import Send from '@/components/Send';
import Receive from '@/components/Receive';
import CreateToken from '@/components/CreateToken';
import TokenDetail from '@/components/TokenDetail';
import Activity from '@/components/Activity';
import TxDetails from '@/components/TxDetails';
import Settings from '@/components/Settings';

const BALANCE_POLL_MS = 20_000;
const HISTORY_STEP = 10;
const FAUCET_UNITS = 1_000_000n;
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.bunkercoin.com';

export type { Submission };

export interface SubmitResult {
  txId: string;
  /** False when the broadcast succeeded but tracking could not be persisted. */
  tracked: boolean;
}

/**
 * Signs with the next reconciled nonce and broadcasts, one per account at a time; refuses while one is unacknowledged,
 * or when funds or a duplicate changed since review. `duplicateOk`: the in-flight tx the user approved sending again.
 */
export type SubmitSigned = (
  build: (nonce: bigint) => SignedTransaction,
  info: Submission,
  duplicateOk?: string | null,
) => Promise<SubmitResult>;

/** What every view reads from the account. */
export interface WalletState {
  conn: BunkerConnection;
  address: string;
  addressHex: string;
  balance: bigint | null;
  tokens: TokenBalance[];
  /** Balance net of in-flight sends and fees; what may be signed now. */
  spendable: Spendable;
  /** `tokens` with in-flight token sends subtracted. */
  spendableTokens: TokenBalance[];
  /** `usually 5-30 min`, from observed block intervals; null until enough were seen. */
  cadence: string | null;
  /** Chain-wide token list (tickers, creators, metadata hashes); null until first loaded. */
  registry: TokenMeta[] | null;
  fee: bigint | null;
  feeError: string;
  slot: bigint | null;
  history: AccountHistory | null;
  historyState: 'idle' | 'loading' | 'error' | 'end';
  pending: PendingTx[];
  /** txId -> when this tab saw it finalize. */
  finalized: Map<string, number>;
  /** txId -> last status poll. */
  checkedAt: Map<string, number>;
  trackingLost: boolean;
  fresh: FreshnessMap;
  offline: boolean;
  rpcHost: string;
}

export interface WalletActions {
  go: (href: string, replace?: boolean) => void;
  refresh: () => Promise<void>;
  refreshFee: () => void;
  submit: SubmitSigned;
  previewNonce: () => Promise<NoncePlan>;
  resend: (txId: string) => void;
  recheck: (txId: string) => void;
  dismiss: (txId: string) => void;
  loadOlder: () => void;
  faucet: () => Promise<void>;
  /** Promotes the metadata document once this Mint or UpdateMetadata finalizes. */
  promoteOnFinal: (txId: string, hash: string) => void;
}

interface DashboardProps {
  signer: Signer;
  inflight: Inflight;
  onLock: () => void;
  onWalletRemoved: () => void | Promise<void>;
  autoLockMinutes: AutoLockMinutes;
  onAutoLockChange: (m: AutoLockMinutes) => void;
}

const noteUncertain = (txId: string, error: string) => (list: PendingTx[]) =>
  list.map((p) => (p.txId === txId && p.state === 'uncertain' ? { ...p, error } : p));

const TAB_VIEWS = new Set(['home', 'activity', 'settings']);

export default function Dashboard({ signer, inflight, onLock, onWalletRemoved, autoLockMinutes, onAutoLockChange }: DashboardProps) {
  const { conn, pending, finalized, checkedAt, trackingLost, account: maybeAccount, apply, startTracking, stopTracking, record } = inflight;
  const account = maybeAccount!;
  const chain = conn.url;
  const address = signer.address;
  const meHex = useMemo(() => addressToHex(address), [address]);
  const rpcHost = useMemo(() => new URL(chain).host, [chain]);
  const [view, go] = useHashView();
  const [settingsFlow, setSettingsFlow] = useState(false);
  useEffect(() => {
    if (view.name !== 'settings') setSettingsFlow(false);
  }, [view.name]);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [registry, setRegistry] = useState<TokenMeta[] | null>(null);
  const [fee, setFee] = useState<bigint | null>(null);
  const [feeError, setFeeError] = useState('');
  const [history, setHistory] = useState<AccountHistory | null>(null);
  const [olderState, setOlderState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [slot, setSlot] = useState<bigint | null>(null);
  const [fresh, setFresh] = useState<FreshnessMap>(initialFreshness);
  const latest = useRef<Partial<Record<Resource | 'registry', number>>>({});
  // Aborted on unmount: in-flight refreshes stop with it; trackers live above the lock.
  const life = useRef<AbortController | null>(null);
  const historyWant = useRef(HISTORY_STEP);
  const [, tick] = useState(0);
  const committed = useRef({ balance, tokens });
  committed.current = { balance, tokens };

  // Only the newest request per resource may write state; slower, older answers are dropped. Resolves false on failure.
  const load = useCallback(
    <T,>(names: Resource | Resource[], fetch: (signal: AbortSignal) => Promise<T>, onValue: (v: T) => void): Promise<boolean> => {
      const signal = life.current?.signal;
      if (!signal || signal.aborted) return Promise.resolve(false);
      const all = typeof names === 'string' ? [names] : names;
      const name = all[0];
      const id = (latest.current[name] ?? 0) + 1;
      latest.current[name] = id;
      const mark = (f: Freshness | ((prev: Freshness) => Freshness)) =>
        setFresh((m) => {
          const next = { ...m };
          for (const n of all) next[n] = typeof f === 'function' ? f(m[n]) : f;
          return next;
        });
      return fetch(signal).then(
        (v) => {
          if (latest.current[name] !== id || signal.aborted) return true;
          onValue(v);
          mark({ okAt: Date.now(), error: null });
          return true;
        },
        (e: Error) => {
          if (latest.current[name] !== id || signal.aborted) return false;
          mark((prev) => ({ ...prev, error: e.message }));
          if (name !== 'fee') return false;
          // A transient outage keeps the last fee; a refused one must not stay signable.
          if (e instanceof RpcError && e.kind !== 'protocol') return false;
          setFee(null);
          setFeeError(e.message);
          return false;
        },
      );
    },
    [],
  );

  const loadFee = useCallback(
    () =>
      load(
        'fee',
        (signal) => conn.getFee({ signal }),
        (v) => {
          setFee(v);
          setFeeError('');
        },
      ),
    [conn, load],
  );

  const loadHistory = useCallback(
    () =>
      load(
        'history',
        (signal) =>
          conn.getAccountHistory(meHex, {
            signal,
            want: historyWant.current,
            maxPages: (historyWant.current / HISTORY_STEP) * 3,
          }),
        setHistory,
      ),
    [conn, meHex, load],
  );

  const loadRegistry = useCallback(() => {
    const signal = life.current?.signal;
    if (!signal) return;
    const id = (latest.current.registry ?? 0) + 1;
    latest.current.registry = id;
    conn.getTokens({ signal }).then(
      (list) => latest.current.registry === id && !signal.aborted && setRegistry(list),
      () => undefined,
    );
  }, [conn]);

  // Balances and settled transfers commit together, so a finalized send stops holding funds in the same update that
  // first shows a balance fetched after it.
  const { entries, markFinal, reconcile, durable } = inflight;
  const loadBalances = useCallback(
    () =>
      load(
        ['balance', 'tokens'],
        async (signal) => {
          const snap = await fetchSnapshot({
            fetch: () => Promise.all([conn.getBalance(address, { signal }), conn.getTokenBalances(address, { signal })]),
            entries,
            statuses: (ids) => conn.getSignatureStatuses(ids, { signal }),
            finalize: markFinal,
          });
          if (snap === null) throw new Error('Balances kept changing while transfers finalized; retrying shortly.');
          return snap;
        },
        ({ value: [b, t], at }) => {
          setBalance(b);
          setTokens(t);
          reconcile(at);
        },
      ),
    [conn, address, load, entries, markFinal, reconcile],
  );

  const refresh = useCallback(async () => {
    loadRegistry();
    await Promise.all([loadBalances(), load('slot', (signal) => conn.getSlot({ signal }), setSlot), loadFee(), loadHistory()]);
  }, [conn, load, loadBalances, loadFee, loadHistory, loadRegistry]);

  // Polling while visible; a transfer settling (tracked above the lock) refreshes balances too.
  useEffect(() => {
    const ctrl = new AbortController();
    life.current = ctrl;
    inflight.onSettled.current = () => void refresh();
    void refresh();
    const visible = () => document.visibilityState === 'visible';
    const poll = setInterval(() => visible() && void refresh(), BALANCE_POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    const onVisible = () => visible() && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    const settledRef = inflight.onSettled;
    return () => {
      ctrl.abort();
      settledRef.current = null;
      life.current = null;
      clearInterval(poll);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, inflight.onSettled]);

  const submit: SubmitSigned = useCallback(
    (build, info, duplicateOk = null) =>
      withAccountLock(address, () => {
        signer.assertActive();
        const { balance: b, tokens: t } = committed.current;
        const problem = revalidate(info, b, t, durable(), duplicateOk);
        if (problem) throw new Error(problem);
        return submitTransaction(
          account,
          (nonce) => {
            signer.assertActive();
            return build(nonce);
          },
          info,
        );
      }),
    [address, signer, account, durable],
  );

  const previewNonce = useCallback(
    () => nextNonce(conn, address, collectOutstanding(account.reservations(), account.entries())),
    [conn, address, account],
  );

  const resend = useCallback(
    (txId: string) =>
      void withAccountLock(address, () => resendUncertain(account, txId)).then(
        (note) => (note === null ? undefined : apply(noteUncertain(txId, note))),
        (e: Error) => apply(noteUncertain(txId, e.message)),
      ),
    [address, account, apply],
  );

  const recheck = useCallback(
    (txId: string) => {
      const entry = loadPending(chain, address).find((p) => p.txId === txId) ?? pending.find((p) => p.txId === txId);
      if (!entry || entry.state === 'failed') return;
      if (entry.state === 'uncertain') return resend(txId);
      stopTracking(txId);
      startTracking(entry);
    },
    [chain, address, pending, resend, stopTracking, startTracking],
  );

  const dismiss = useCallback(
    (txId: string) => {
      stopTracking(txId);
      void apply(removeEntry(txId));
    },
    [apply, stopTracking],
  );

  const loadOlder = useCallback(() => {
    historyWant.current += HISTORY_STEP;
    setOlderState('loading');
    void loadHistory().then((ok) => setOlderState(ok ? 'idle' : 'error'));
  }, [loadHistory]);

  const faucet = useCallback(async () => {
    const txId = await conn.requestAirdrop(address, FAUCET_UNITS);
    await record(txId, { kind: 'faucet', amount: FAUCET_UNITS });
  }, [conn, address, record]);

  const { status, failing } = connectionStatus(fresh);
  const offline = status === 'offline' || status === 'stale';
  const historyState: WalletState['historyState'] =
    olderState !== 'idle' ? olderState : history?.end === 'exhausted' ? 'end' : 'idle';

  const state: WalletState = {
    conn,
    address,
    addressHex: meHex,
    balance,
    tokens,
    spendable: nativeSpendable(balance, pending),
    spendableTokens: spendableTokens(tokens, pending),
    cadence: cadenceHint(inflight.intervals),
    registry,
    fee,
    feeError,
    slot,
    history,
    historyState,
    pending,
    finalized,
    checkedAt,
    trackingLost,
    fresh,
    offline,
    rpcHost,
  };
  const actions: WalletActions = {
    go,
    refresh,
    refreshFee: () => void loadFee(),
    submit,
    previewNonce,
    resend,
    recheck,
    dismiss,
    loadOlder,
    faucet,
    promoteOnFinal: inflight.promoteOnFinal,
  };

  const tab = TAB_VIEWS.has(view.name) && view.param === null && !(view.name === 'settings' && settingsFlow) ? view.name : null;
  const nav: NavItem[] = ['home', 'activity', 'settings'].map((n) => ({ label: n, href: `#${n}`, current: view.name === n }));
  const lastOk = fresh.balance.okAt;

  return (
    <AppShell
      app="wallet"
      brandHref="#home"
      nav={nav}
      flow={!tab}
      tools={
        <>
          {offline ? (
            <StatusTag status="offline" className="bc-net" />
          ) : status === 'partial' ? (
            <Tag state="unknown" className="bc-net">
              testnet · partial<span className="bc-sr">: {failing.join(', ')} unavailable</span>
            </Tag>
          ) : (
            <Tag state={status === 'live' ? 'live' : 'neutral'} className="bc-net">
              testnet
            </Tag>
          )}
          <AddressChip address={address} />
          <Button variant="ghost" size="sm" onClick={onLock} aria-label="lock">
            <Icon name="lock" />
            <span className="max-sm:hidden">lock</span>
          </Button>
        </>
      }
      banner={
        offline ? (
          <Banner
            action={
              <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                retry
              </Button>
            }
          >
            Offline. Can&apos;t reach {rpcHost}
            {lastOk !== null ? `; values are from ${utcClock(lastOk)}.` : '.'}
          </Banner>
        ) : undefined
      }
      footer={
        <Footer
          links={[
            { label: 'explorer', href: EXPLORER_URL, external: true },
            { label: 'source', href: 'https://github.com/bunkercoinorg/bunkercoin', external: true },
          ]}
        >
          keys stay in this browser.
        </Footer>
      }
      tabBar={tab ? <TabBar current={tab} /> : undefined}
    >
      <div className="bc-col-app">
        {view.name === 'settings' ? (
          <Settings
            address={address}
            autoLockMinutes={autoLockMinutes}
            onAutoLockChange={onAutoLockChange}
            rpcHost={rpcHost}
            onWalletRemoved={onWalletRemoved}
            onFlowChange={setSettingsFlow}
          />
        ) : (
          <ViewSwitch view={view} state={state} actions={actions} signer={signer} />
        )}
      </div>
    </AppShell>
  );
}

function ViewSwitch({ view, state, actions, signer }: { view: View; state: WalletState; actions: WalletActions; signer: Signer }) {
  switch (view.name) {
    case 'send':
      return <Send key={view.param ?? 'native'} state={state} actions={actions} signer={signer} preset={view.param} />;
    case 'receive':
      return <Receive address={state.address} onBack={() => actions.go(viewHref('home'))} />;
    case 'token':
      return <CreateToken state={state} actions={actions} signer={signer} />;
    case 'tokens':
      return <TokenDetail key={view.param} tokenId={view.param ?? ''} state={state} actions={actions} signer={signer} />;
    case 'activity':
      return <Activity state={state} actions={actions} />;
    case 'tx':
      return <TxDetails key={view.param} txId={view.param ?? ''} state={state} actions={actions} />;
    default:
      return <Home state={state} actions={actions} />;
  }
}
