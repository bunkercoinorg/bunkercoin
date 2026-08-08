'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BunkerConnection, type ChainTransaction, type TokenBalance } from '@/lib/connection';
import { addressToHex, type Keypair } from '@/lib/keys';
import { loadPending, addPending, removePending, type PendingTx } from '@/lib/pending';
import BalanceCard from '@/components/BalanceCard';
import Faucet from '@/components/Faucet';
import Send from '@/components/Send';
import CreateToken from '@/components/CreateToken';
import Activity from '@/components/Activity';
import RecoveryPhrase from '@/components/RecoveryPhrase';
import DangerZone from '@/components/DangerZone';
import { Button } from '@/components/ui';

const BALANCE_POLL_MS = 20_000;

interface DashboardProps {
  keypair: Keypair;
  onLock: () => void;
  onWalletRemoved: () => void;
}

export default function Dashboard({ keypair, onLock, onWalletRemoved }: DashboardProps) {
  const conn = useRef(new BunkerConnection()).current;
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [history, setHistory] = useState<ChainTransaction[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  const [, tick] = useState(0);

  const refresh = useCallback(async () => {
    const meHex = addressToHex(keypair.address);
    try {
      setBalance(await conn.getBalance(keypair.address));
      setTokens(await conn.getTokenBalances(keypair.address));
      setSlot(await conn.getSlot());
      const txs = await conn.getTransactions(200, 0);
      setHistory(txs.filter((t) => t.sender === meHex || t.body?.to === meHex).slice(0, 10));
    } catch {
      // Keep the last known values through RPC blips.
    }
  }, [conn, keypair.address]);

  useEffect(() => {
    setPending(loadPending());
    void refresh();
    const balancePoll = setInterval(refresh, BALANCE_POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(balancePoll);
      clearInterval(clock);
    };
  }, [refresh]);

  const trackConfirmation = useCallback(
    async (entry: PendingTx, signal?: AbortSignal) => {
      try {
        await conn.confirm(entry.txId, { signal });
        setPending(removePending(entry.txId));
        void refresh();
      } catch (e) {
        if (String((e as Error).message).includes('cancelled')) return;
        setPending((prev) =>
          prev.map((p) => (p.txId === entry.txId ? { ...p, failed: String((e as Error).message) } : p)),
        );
      }
    },
    [conn, refresh],
  );

  // Resume confirmation polling for every pending tx (incl. after reload).
  useEffect(() => {
    const abort = new AbortController();
    for (const entry of loadPending()) {
      void trackConfirmation(entry, abort.signal);
    }
    return () => abort.abort();
  }, [trackConfirmation]);

  const submitted = (entry: PendingTx) => {
    setPending(addPending(entry));
    void trackConfirmation(entry);
  };

  return (
    <>
      <div className="mb-3.5 flex items-center gap-2">
        <span
          className="flex items-center gap-[7px] font-mono text-[11px] tracking-[0.12em] uppercase text-muted"
          title={slot === null ? undefined : `chain slot ${slot}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(0,255,178,0.22)]" />
          {slot === null ? 'connecting…' : 'live'}
        </span>
        <span className="flex-1" />
        <Button variant="ghost" small onClick={onLock}>
          Lock
        </Button>
      </div>

      <BalanceCard address={keypair.address} balance={balance} tokens={tokens} />
      <Faucet conn={conn} address={keypair.address} onSubmitted={submitted} />
      <Send conn={conn} keypair={keypair} balance={balance} tokens={tokens} onSubmitted={submitted} />
      <CreateToken conn={conn} keypair={keypair} balance={balance} onSubmitted={submitted} />
      <Activity
        address={keypair.address}
        pending={pending}
        history={history}
        onDismiss={(txId) => setPending(removePending(txId))}
      />
      <RecoveryPhrase />
      <DangerZone onWalletRemoved={onWalletRemoved} />
    </>
  );
}
