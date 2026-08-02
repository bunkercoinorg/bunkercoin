'use client';

import { useEffect, useState } from 'react';
import { decryptMnemonic, loadKeystore, clearKeystore } from '@/lib/keystore';
import { keypairFromMnemonic, type Keypair } from '@/lib/keys';

interface UnlockProps {
  onUnlocked: (keypair: Keypair) => void;
  onReset: () => void;
}

export default function Unlock({ onUnlocked, onReset }: UnlockProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Honest telemetry: derivation is slow on purpose, so show it working.
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(timer);
  }, [busy]);

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
      setElapsed(0);
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
        <div className="kdf" role="status" aria-live="polite">
          <div className="kdf-track">
            <div className="kdf-bar" />
          </div>
          <div className="kdf-line">
            <span>Deriving key · argon2id · 256 MiB</span>
            <span className="t">{elapsed.toFixed(1)}s</span>
          </div>
        </div>
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
      <p className="gate-telemetry">keystore · aes-256-gcm · local only</p>
    </div>
  );
}
