'use client';

import { useState } from 'react';
import { decryptMnemonic, requireKeystore } from '@/lib/keystore';
import { keypairFromMnemonic, type Keypair } from '@/lib/keys';
import { useElapsed } from '@/hooks/useElapsed';
import KdfProgress from '@/components/KdfProgress';
import { Button, ErrorText, Input } from '@/components/ui';

interface UnlockProps {
  onUnlocked: (keypair: Keypair) => void;
  onReset: () => void;
}

export default function Unlock({ onUnlocked, onReset }: UnlockProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const elapsed = useElapsed(busy);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const mnemonic = await decryptMnemonic(requireKeystore(), password);
      onUnlocked(keypairFromMnemonic(mnemonic));
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
        <KdfProgress label="Unlocking — checking your password" elapsed={elapsed} />
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
