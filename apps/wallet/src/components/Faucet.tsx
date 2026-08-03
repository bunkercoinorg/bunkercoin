'use client';

import { useState } from 'react';
import type { BunkerConnection } from '@/lib/connection';
import type { PendingTx } from '@/lib/pending';

const FAUCET_UNITS = 1_000_000; // 1 BUNKER per tap

interface FaucetProps {
  conn: BunkerConnection;
  address: string;
  onSubmitted: (entry: PendingTx) => void;
}

export default function Faucet({ conn, address, onSubmitted }: FaucetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = async () => {
    setBusy(true);
    setError('');
    try {
      const txId = await conn.requestAirdrop(address, FAUCET_UNITS);
      onSubmitted({ txId, kind: 'faucet', amount: FAUCET_UNITS, at: Date.now() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Faucet</h2>
      <p className="sub">Testnet tokens, free. 1 BUNKER per request.</p>
      <button className="btn-ghost" disabled={busy} onClick={request}>
        {busy ? 'Requesting…' : 'Request 1 BUNKER'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
