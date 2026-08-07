'use client';

import { useState } from 'react';
import type { BunkerConnection } from '@/lib/connection';
import { signMint, metadataHash, isValidTicker, type Keypair } from '@/lib/keys';
import { formatUnits } from '@/lib/format';
import type { PendingTx } from '@/lib/pending';
import { Button, Card, Divider, ErrorText, Hint, Input, Label } from '@/components/ui';

interface CreateTokenProps {
  conn: BunkerConnection;
  keypair: Keypair;
  balance: number | null;
  onSubmitted: (entry: PendingTx) => void;
}

export default function CreateToken({ conn, keypair, balance, onSubmitted }: CreateTokenProps) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [supply, setSupply] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTicker('');
    setSupply('');
    setName('');
    setDescription('');
    setError('');
    setOpen(false);
  };

  const submit = async () => {
    setError('');
    const symbol = ticker.trim().toUpperCase();
    if (!isValidTicker(symbol)) {
      setError('Use 3-8 letters or numbers, e.g. BNKR.');
      return;
    }
    const total = Number(supply.replace(/[, ]/g, ''));
    if (!Number.isInteger(total) || total <= 0) {
      setError('Enter a whole number of tokens to create.');
      return;
    }
    if (total > Number.MAX_SAFE_INTEGER) {
      setError('That supply is too large.');
      return;
    }
    setBusy(true);
    try {
      // Tickers are unique chain-wide and first-come; check before paying a fee.
      const taken = (await conn.getTokens()).some((t) => t.ticker === symbol);
      if (taken) {
        setError(`${symbol} is already taken. Try another symbol.`);
        return;
      }
      const fee = await conn.getFee().catch(() => 100);
      if (balance !== null && balance < fee) {
        setError('Not enough BUNKER to cover the network fee.');
        return;
      }
      const nonce = await conn.getNonce(keypair.address);
      const tx = signMint({
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
        ticker: symbol,
        maxSupply: total,
        // The chain stores only this hash; the JSON itself is off-chain.
        metadataHash: metadataHash({ name: name.trim() || symbol, description: description.trim() }),
        nonce,
        fee,
      });
      const txId = await conn.sendTransaction(tx);
      onSubmitted({ txId, kind: 'mint', amount: total, ticker: symbol, at: Date.now() });
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Card title="Create a token" sub="Issue your own token on the BunkerCoin network.">
        <Button variant="ghost" small onClick={() => setOpen(true)}>
          Create a token…
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title="Create a token"
      sub="You receive the entire supply. The symbol is claimed network-wide and cannot be changed later."
    >
      <Label>Symbol</Label>
      <Input
        value={ticker}
        placeholder="BNKR"
        maxLength={8}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        disabled={busy}
        onChange={(e) => {
          setTicker(e.target.value.toUpperCase());
          setError('');
        }}
      />
      <Label>Total supply</Label>
      <Input
        value={supply}
        placeholder="1000000"
        inputMode="numeric"
        disabled={busy}
        onChange={(e) => {
          setSupply(e.target.value);
          setError('');
        }}
      />
      <Label>Name (optional)</Label>
      <Input
        value={name}
        placeholder="Bunker Token"
        autoCapitalize="words"
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
      />
      <Label>Description (optional)</Label>
      <Input
        value={description}
        placeholder="What is this token for?"
        disabled={busy}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Hint>Network fee: {formatUnits(100)} BUNKER · takes a few minutes to confirm over radio</Hint>
      {error && <ErrorText>{error}</ErrorText>}
      <Divider />
      <div className="flex gap-2.5 *:flex-1">
        <Button variant="ghost" disabled={busy} onClick={reset}>
          Cancel
        </Button>
        <Button disabled={busy || !ticker || !supply} onClick={submit}>
          {busy ? 'Creating…' : 'Create token'}
        </Button>
      </div>
    </Card>
  );
}
