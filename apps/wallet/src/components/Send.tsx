'use client';

import { useEffect, useState } from 'react';
import type { BunkerConnection } from '@/lib/connection';
import { signTransfer, isValidAddress, type Keypair } from '@/lib/keys';
import { formatUnits, parseBunker } from '@/lib/format';
import type { PendingTx } from '@/lib/pending';
import { Button, Card, Divider, ErrorText, Hint, Input, Label } from '@/components/ui';

interface SendProps {
  conn: BunkerConnection;
  keypair: Keypair;
  balance: number | null;
  onSubmitted: (entry: PendingTx) => void;
}

export default function Send({ conn, keypair, balance, onSubmitted }: SendProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    conn.getFee().then(setFee).catch(() => {});
  }, [conn]);

  const submit = async () => {
    setError('');
    let units: number;
    try {
      units = parseBunker(amount);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!isValidAddress(to)) {
      setError('That is not a valid BunkerCoin address.');
      return;
    }
    if (to.trim() === keypair.address) {
      setError('That is your own address.');
      return;
    }
    const currentFee = fee ?? 100;
    if (balance !== null && units + currentFee > balance) {
      setError(`Insufficient balance (fee is ${formatUnits(currentFee)} BUNKER).`);
      return;
    }
    setBusy(true);
    try {
      // Nonce is fetched at send time: it must match the account's current value.
      const nonce = await conn.getNonce(keypair.address);
      const tx = signTransfer({
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
        to: to.trim(),
        amount: units,
        nonce,
        fee: currentFee,
      });
      const txId = await conn.sendTransaction(tx);
      onSubmitted({ txId, kind: 'send', to: to.trim(), amount: units, at: Date.now() });
      setTo('');
      setAmount('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Send">
      <Label>Recipient address</Label>
      <Input
        value={to}
        placeholder="base58 address"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setTo(e.target.value);
          setError('');
        }}
      />
      <Label>Amount (BUNKER)</Label>
      <Input
        value={amount}
        placeholder="0.25"
        inputMode="decimal"
        onChange={(e) => {
          setAmount(e.target.value);
          setError('');
        }}
      />
      {fee !== null && <Hint>Network fee: {formatUnits(fee)} BUNKER</Hint>}
      {error && <ErrorText>{error}</ErrorText>}
      <Divider />
      <Button disabled={busy || !to || !amount} onClick={submit}>
        {busy ? 'Signing & sending…' : 'Send'}
      </Button>
    </Card>
  );
}
