'use client';

import { useState } from 'react';
import type { BunkerConnection } from '@/lib/connection';
import { signMint, metadataHash, isValidTicker } from '@/lib/keys';
import { formatUnits, parseCount } from '@/lib/format';
import type { Signer } from '@/lib/signer';
import type { SubmitSigned } from '@/components/Dashboard';
import { Button, Card, Divider, ErrorText, Hint, Input, Label } from '@/components/ui';

interface CreateTokenProps {
  conn: BunkerConnection;
  signer: Signer;
  balance: bigint | null;
  fee: bigint | null;
  feeError: string;
  submit: SubmitSigned;
}

export default function CreateToken({ conn, signer, balance, fee, feeError, submit }: CreateTokenProps) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [supply, setSupply] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reset = () => {
    setTicker('');
    setSupply('');
    setName('');
    setDescription('');
    setError('');
    setOpen(false);
  };

  const create = async () => {
    setError('');
    setNotice('');
    const symbol = ticker.trim().toUpperCase();
    if (!isValidTicker(symbol)) {
      setError('Use 3-8 letters or numbers, e.g. BNKR.');
      return;
    }
    let total: bigint;
    try {
      total = parseCount(supply);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg.includes('large') ? 'That supply is too large.' : 'Enter a whole number of tokens to create.');
      return;
    }
    if (fee === null) {
      setError(feeError ? `Network fee unavailable: ${feeError}` : 'The network fee has not loaded yet.');
      return;
    }
    // The fee on screen is the fee that gets signed.
    const reviewedFee = fee;
    if (balance !== null && balance < reviewedFee) {
      setError('Not enough BUNKER to cover the network fee.');
      return;
    }
    // The chain stores only this hash; the JSON itself is off-chain.
    const hash = metadataHash({ name: name.trim() || symbol, description: description.trim() });
    setBusy(true);
    try {
      // Tickers are unique chain-wide and first-come; check before paying a fee.
      const taken = (await conn.getTokens()).some((t) => t.ticker === symbol);
      if (taken) {
        setError(`${symbol} is already taken. Try another symbol.`);
        return;
      }
      const { txId, tracked } = await submit(
        (nonce) =>
          signer.use((privateKey, publicKey) =>
            signMint({ privateKey, publicKey, ticker: symbol, maxSupply: total, metadataHash: hash, nonce, fee: reviewedFee }),
          ),
        { kind: 'mint', amount: total, ticker: symbol },
      );
      reset();
      if (!tracked) {
        setNotice(`Submitted (${txId.slice(0, 6)}…). Tracking could not be saved on this device, so it will not survive a reload.`);
      }
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
        {notice && <Hint>{notice}</Hint>}
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
      <Hint>
        Network fee: {fee !== null ? `${formatUnits(fee)} BUNKER` : `unavailable${feeError ? ` (${feeError})` : ''}`} · takes
        a few minutes to confirm over radio
      </Hint>
      {error && <ErrorText>{error}</ErrorText>}
      <Divider />
      <div className="flex gap-2.5 *:flex-1">
        <Button variant="ghost" disabled={busy} onClick={reset}>
          Cancel
        </Button>
        <Button disabled={busy || !ticker || !supply || fee === null} onClick={create}>
          {busy ? 'Creating…' : 'Create token'}
        </Button>
      </div>
    </Card>
  );
}
