'use client';

import { useState } from 'react';
import { keypairFromMnemonic } from '@/lib/keys';
import type { FinishUnlock } from '@/lib/unlock';
import { encryptMnemonic, saveKeystore } from '@/lib/keystore';
import { useElapsed } from '@/hooks/useElapsed';
import KdfProgress from '@/components/KdfProgress';
import { Button, Card, Divider, ErrorText, Input, Label } from '@/components/ui';

const MIN_PASSWORD = 8;

interface SetPasswordProps {
  mnemonic: string;
  beginUnlock: () => FinishUnlock;
}

export default function SetPassword({ mnemonic, beginUnlock }: SetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(false);
  const elapsed = useElapsed(busy);

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    setFallback(false);
    const finish = beginUnlock();
    try {
      // Deliberately slow (Argon2id): this cost is what a thief pays per guess.
      const record = await encryptMnemonic(mnemonic, password, undefined, { onFallback: () => setFallback(true) });
      await saveKeystore(record, finish.current);
      if (!finish(keypairFromMnemonic(mnemonic), record)) throw new Error('The wallet on this device changed meanwhile.');
    } catch (e) {
      setError((e as Error).message || 'Encryption failed');
      setBusy(false);
    }
  };

  return (
    <Card
      title="Choose a password"
      sub="It encrypts your recovery phrase on this device. You will need it every time you open the wallet — it cannot be reset, only re-created from the 24 words."
    >
      <Label>Password</Label>
      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
      <Label>Repeat password</Label>
      <Input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={busy}
        onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
      />
      {error && <ErrorText>{error}</ErrorText>}
      {busy ? (
        <KdfProgress label="Encrypting your recovery phrase" elapsed={elapsed} fallback={fallback} />
      ) : (
        <>
          <Divider />
          <Button disabled={!password || !confirm} onClick={submit}>
            Encrypt and finish
          </Button>
        </>
      )}
    </Card>
  );
}
