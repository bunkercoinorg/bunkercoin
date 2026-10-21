'use client';

import { useState } from 'react';
import { decryptMnemonic, requireKeystore } from '@/lib/keystore';
import { keypairFromMnemonic } from '@/lib/keys';
import type { FinishUnlock } from '@/lib/unlock';
import { useElapsed } from '@/hooks/useElapsed';
import KdfProgress from '@/components/KdfProgress';
import { Button, ErrorText, Input } from '@/components/ui';

interface UnlockProps {
  beginUnlock: () => FinishUnlock;
  onReset: () => void;
}

export default function Unlock({ beginUnlock, onReset }: UnlockProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [fallback, setFallback] = useState(false);
  const elapsed = useElapsed(busy);

  const submit = async () => {
    setBusy(true);
    setError('');
    setFallback(false);
    const finish = beginUnlock();
    try {
      const record = requireKeystore();
      const mnemonic = await decryptMnemonic(record, password, { onFallback: () => setFallback(true) });
      if (!finish(keypairFromMnemonic(mnemonic), record)) throw new Error('The wallet on this device changed meanwhile.');
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'Incorrect password' ? 'Incorrect password.' : msg);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-105">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bunker-favicon.png" alt="" width={40} height={40} className="mx-auto mb-4.5 block rounded-lg" />
      <h2 className="mb-2 text-center text-[21px] font-semibold tracking-tight">Unlock your wallet</h2>
      <p className="mb-6.5 text-center text-[13.5px] leading-relaxed text-muted">
        Keys stay on this device, decrypted only in memory.
      </p>

      <Input
        type="password"
        aria-label="Password"
        placeholder="Password"
        value={password}
        autoFocus
        disabled={busy}
        onChange={(e) => {
          setPassword(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => e.key === 'Enter' && password && !busy && submit()}
      />
      {error && <ErrorText>{error}</ErrorText>}

      {busy ? (
        <KdfProgress label="Unlocking — checking your password" elapsed={elapsed} fallback={fallback} />
      ) : (
        <div className="mt-4.5">
          <Button disabled={!password} onClick={submit}>
            Unlock
          </Button>
        </div>
      )}

      <p className="mt-8.5 text-center text-[12.5px] leading-relaxed text-faint">
        Forgot the password? The only way back in is your 24-word recovery phrase.
        <br />
        {confirmReset ? (
          <Button
            variant="danger"
            small
            className="mt-2.5"
            onClick={onReset}
          >
            Really erase this wallet from the device
          </Button>
        ) : (
          <Button variant="link" onClick={() => setConfirmReset(true)}>
            Erase and recover
          </Button>
        )}
      </p>
    </div>
  );
}
