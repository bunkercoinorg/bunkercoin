'use client';

import { useState } from 'react';
import { NATIVE_TICKER, tokenLabel, type TokenBalance } from '@/lib/connection';
import {
  assetKey,
  isValidAddress,
  NATIVE_ASSET,
  signTokenTransfer,
  signTransfer,
  tokenIdBytes,
  type Asset,
} from '@/lib/keys';
import { formatCount, formatUnits, parseBunker, parseCount, shortAddress } from '@/lib/format';
import type { Signer } from '@/lib/signer';
import type { SubmitSigned } from '@/components/Dashboard';
import { Button, Card, Divider, ErrorText, Hint, Input, Label } from '@/components/ui';


interface SendProps {
  signer: Signer;
  balance: bigint | null;
  tokens: TokenBalance[];
  fee: bigint | null;
  feeError: string;
  submit: SubmitSigned;
}

export default function Send({ signer, balance, tokens, fee, feeError, submit }: SendProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<Asset>(NATIVE_ASSET);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = asset.kind === 'token' ? (tokens.find((t) => t.tokenId === asset.tokenId) ?? null) : null;
  const assetLabel = asset.kind === 'native' ? NATIVE_TICKER : selected ? tokenLabel(selected) : `Token ${asset.tokenId}`;

  const send = async () => {
    setError('');
    setNotice('');
    if (asset.kind === 'token' && !selected) {
      setError('That token is no longer in this wallet.');
      return;
    }
    let units: bigint;
    try {
      units = selected ? parseCount(amount) : parseBunker(amount);
    } catch (e) {
      const msg = (e as Error).message;
      setError(selected && msg.includes('whole') ? 'Enter a whole number of tokens.' : msg);
      return;
    }
    if (selected && units > selected.balance) {
      setError(`You only hold ${formatCount(selected.balance)} ${assetLabel}.`);
      return;
    }
    const recipient = to.trim();
    if (!isValidAddress(recipient)) {
      setError('That is not a valid BunkerCoin address.');
      return;
    }
    if (recipient === signer.address) {
      setError('That is your own address.');
      return;
    }
    if (fee === null) {
      setError(feeError ? `Network fee unavailable: ${feeError}` : 'The network fee has not loaded yet.');
      return;
    }
    // The fee on screen is the fee that gets signed.
    const reviewedFee = fee;
    if (!selected && balance !== null && units + reviewedFee > balance) {
      setError(`Insufficient balance (fee is ${formatUnits(reviewedFee)} BUNKER).`);
      return;
    }
    // Token transfers still pay their fee in BUNKER.
    if (selected && balance !== null && balance < reviewedFee) {
      setError(`Not enough BUNKER for the ${formatUnits(reviewedFee)} fee.`);
      return;
    }
    setBusy(true);
    try {
      const { txId, tracked } = await submit(
        (nonce) =>
          signer.use((privateKey, publicKey) =>
            selected
              ? signTokenTransfer({
                  privateKey,
                  publicKey,
                  to: recipient,
                  tokenId: tokenIdBytes(selected.tokenId),
                  amount: units,
                  nonce,
                  fee: reviewedFee,
                })
              : signTransfer({ privateKey, publicKey, to: recipient, amount: units, nonce, fee: reviewedFee }),
          ),
        { kind: selected ? 'token-send' : 'send', to: recipient, amount: units, ticker: selected ? assetLabel : undefined },
      );
      setTo('');
      setAmount('');
      if (!tracked) {
        setNotice(
          `Sent (${shortAddress(txId, 6)}). Tracking could not be saved on this device, so it will not survive a reload.`,
        );
      }
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
            {[
              { asset: NATIVE_ASSET, label: NATIVE_TICKER },
              ...tokens.map((t) => ({ asset: { kind: 'token', tokenId: t.tokenId } as Asset, label: tokenLabel(t) })),
            ].map((option) => (
              <Button
                key={assetKey(option.asset)}
                variant={assetKey(asset) === assetKey(option.asset) ? 'primary' : 'ghost'}
                small
                onClick={() => {
                  setAsset(option.asset);
                  setAmount('');
                  setError('');
                }}
              >
                {option.label}
              </Button>
            ))}
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
      <Label>Amount ({assetLabel})</Label>
      <Input
        value={amount}
        placeholder={asset.kind === 'token' ? '100' : '0.25'}
        inputMode="decimal"
        onChange={(e) => {
          setAmount(e.target.value);
          setError('');
        }}
      />
      {fee !== null ? (
        <Hint>Network fee: {formatUnits(fee)} BUNKER</Hint>
      ) : (
        feeError && <Hint>Network fee unavailable: {feeError}</Hint>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      {notice && <Hint>{notice}</Hint>}
      <Divider />
      <Button disabled={busy || !to || !amount || fee === null} onClick={send}>
        {busy ? 'Signing & sending…' : 'Send'}
      </Button>
    </Card>
  );
}
