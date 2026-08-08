'use client';

import { useEffect, useState } from 'react';
import type { BunkerConnection, TokenBalance } from '@/lib/connection';
import { signTransfer, signTokenTransfer, isValidAddress, type Keypair } from '@/lib/keys';
import { formatUnits, parseBunker } from '@/lib/format';
import type { PendingTx } from '@/lib/pending';
import { Button, Card, Divider, ErrorText, Hint, Input, Label } from '@/components/ui';

const NATIVE = 'BUNKER';

interface SendProps {
  conn: BunkerConnection;
  keypair: Keypair;
  balance: number | null;
  tokens: TokenBalance[];
  onSubmitted: (entry: PendingTx) => void;
}

const tokenIdBytes = (t: TokenBalance): Uint8Array => {
  const raw = t.tokenId ?? t.token_id ?? 0;
  // Token ids arrive as a hex string or a number; the chain wants 4 raw bytes.
  if (typeof raw === 'string' && /^[0-9a-fA-F]{8}$/.test(raw)) {
    return Uint8Array.from(raw.match(/../g)!.map((b) => parseInt(b, 16)));
  }
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, Number(raw), true);
  return bytes;
};

export default function Send({ conn, keypair, balance, tokens, onSubmitted }: SendProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState(NATIVE);
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    conn.getFee().then(setFee).catch(() => {});
  }, [conn]);

  const selected = tokens.find((t) => (t.ticker || String(t.tokenId ?? t.token_id)) === asset);
  const isToken = asset !== NATIVE && !!selected;

  const submit = async () => {
    setError('');
    let units: number;
    if (isToken) {
      // Custom tokens have no decimals on-chain — whole counts only.
      units = Number(amount.replace(/[, ]/g, ''));
      if (!Number.isInteger(units) || units <= 0) {
        setError('Enter a whole number of tokens.');
        return;
      }
      const held = selected?.amount ?? selected?.balance ?? 0;
      if (units > held) {
        setError(`You only hold ${held.toLocaleString()} ${asset}.`);
        return;
      }
    } else {
      try {
        units = parseBunker(amount);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
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
    if (!isToken && balance !== null && units + currentFee > balance) {
      setError(`Insufficient balance (fee is ${formatUnits(currentFee)} BUNKER).`);
      return;
    }
    // Token transfers still pay their fee in BUNKER.
    if (isToken && balance !== null && balance < currentFee) {
      setError(`Not enough BUNKER for the ${formatUnits(currentFee)} fee.`);
      return;
    }
    setBusy(true);
    try {
      // Nonce is fetched at send time: it must match the account's current value.
      const nonce = await conn.getNonce(keypair.address);
      const tx = isToken
        ? signTokenTransfer({
            privateKey: keypair.privateKey,
            publicKey: keypair.publicKey,
            to: to.trim(),
            tokenId: tokenIdBytes(selected!),
            amount: units,
            nonce,
            fee: currentFee,
          })
        : signTransfer({
            privateKey: keypair.privateKey,
            publicKey: keypair.publicKey,
            to: to.trim(),
            amount: units,
            nonce,
            fee: currentFee,
          });
      const txId = await conn.sendTransaction(tx);
      onSubmitted({
        txId,
        kind: isToken ? 'token-send' : 'send',
        to: to.trim(),
        amount: units,
        ticker: isToken ? asset : undefined,
        at: Date.now(),
      });
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
      {tokens.length > 0 && (
        <>
          <Label>Asset</Label>
          <div className="flex flex-wrap gap-2">
            {[NATIVE, ...tokens.map((t, i) => t.ticker || `Token ${t.tokenId ?? t.token_id ?? i}`)].map(
              (label) => (
                <Button
                  key={label}
                  variant={asset === label ? 'primary' : 'ghost'}
                  small
                  onClick={() => {
                    setAsset(label);
                    setAmount('');
                    setError('');
                  }}
                >
                  {label}
                </Button>
              ),
            )}
          </div>
        </>
      )}
      <Label>Recipient address</Label>
      <Input
        value={to}
        placeholder="e.g. 5k1S1Sfj1JSdmTXixc5y12qxBjfGp7LeyEtpEnbKBgZK"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setTo(e.target.value);
          setError('');
        }}
      />
      <Label>Amount ({asset})</Label>
      <Input
        value={amount}
        placeholder={isToken ? '100' : '0.25'}
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
