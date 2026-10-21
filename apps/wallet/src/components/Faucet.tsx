'use client';

import { useState } from 'react';
import type { BunkerConnection } from '@/lib/connection';
import type { RecordSubmitted } from '@/components/Dashboard';
import { Button, Card, ErrorText } from '@/components/ui';

const FAUCET_UNITS = 1_000_000n; // 1 BUNKER per tap

interface FaucetProps {
  conn: BunkerConnection;
  address: string;
  onSubmitted: RecordSubmitted;
}

export default function Faucet({ conn, address, onSubmitted }: FaucetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = async () => {
    setBusy(true);
    setError('');
    try {
      const txId = await conn.requestAirdrop(address, FAUCET_UNITS);
      await onSubmitted(txId, { kind: 'faucet', amount: FAUCET_UNITS });
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
