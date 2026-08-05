'use client';

import { useState } from 'react';
import type { BunkerConnection } from '@/lib/connection';
import type { PendingTx } from '@/lib/pending';
import { Button, Card, ErrorText } from '@/components/ui';

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
    <Card title="Faucet" sub="Testnet tokens, free. 1 BUNKER per request.">
      <Button variant="ghost" disabled={busy} onClick={request}>
        {busy ? 'Requesting…' : 'Request 1 BUNKER'}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}
