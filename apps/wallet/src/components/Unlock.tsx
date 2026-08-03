'use client';

import { useState } from 'react';
import { decryptMnemonic, loadKeystore, clearKeystore } from '@/lib/keystore';
import { keypairFromMnemonic, type Keypair } from '@/lib/keys';
import { useElapsed } from '@/hooks/useElapsed';
import KdfProgress from '@/components/KdfProgress';

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
      const mnemonic = await decryptMnemonic(loadKeystore(), password);
      onUnlocked(keypairFromMnemonic(mnemonic));
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'Incorrect password' ? 'Incorrect password.' : msg);
      setBusy(false);
    }
  };

  return (
    <div className="card gate">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bunker-favicon.png" alt="" width={40} height={40} className="gate-mark" />
      <h2>Unlock your wallet</h2>
      <p className="sub">Keys stay on this device, decrypted only in memory.</p>

      <input
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
      {error && <p className="error">{error}</p>}

      {busy ? (
        <KdfProgress label="Unlocking — checking your password" elapsed={elapsed} />
      ) : (
        <div style={{ marginTop: 18 }}>
          <button className="btn-primary" disabled={!password} onClick={submit}>
            Unlock
          </button>
        </div>
      )}

      <p className="gate-foot">
        Forgot the password? The only way back in is your 24-word recovery phrase.
        <br />
        {confirmReset ? (
          <button
            className="btn-danger btn-small"
            style={{ marginTop: 10 }}
            onClick={() => {
              clearKeystore();
              onReset();
            }}
          >
            Really erase this wallet from the device
          </button>
        ) : (
          <button className="btn-link" onClick={() => setConfirmReset(true)}>
            Erase and recover
          </button>
        )}
      </p>
    </div>
  );
}
