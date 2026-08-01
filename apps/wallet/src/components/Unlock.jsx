'use client';

import { useState } from 'react';
import { decryptMnemonic, loadKeystore, clearKeystore } from '@/lib/keystore';
import { keypairFromMnemonic } from '@/lib/keys';

export default function Unlock({ onUnlocked, onReset }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const mnemonic = await decryptMnemonic(loadKeystore(), password);
      onUnlocked(keypairFromMnemonic(mnemonic));
    } catch (e) {
      setError(e.message === 'Incorrect password' ? 'Incorrect password.' : e.message);
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Unlock your wallet</h2>
      <p className="sub">Your keys stay on this device and are decrypted only in memory.</p>
      <label>Password</label>
      <input
        type="password"
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
      {busy && (
        <div className="progress">
          <span className="spinner" />
          Decrypting — intentionally takes a few seconds…
        </div>
      )}
      <hr className="divider" />
      <button className="btn-primary" disabled={busy || !password} onClick={submit}>
        Unlock
      </button>
      <p className="hint">
        Forgot the password? The only way back in is your 24-word recovery phrase.{' '}
        {confirmReset ? (
          <button
            className="btn-danger btn-small"
            onClick={() => {
              clearKeystore();
              onReset();
            }}
          >
            Really erase this wallet from the device
          </button>
        ) : (
          <button className="btn-danger btn-small" onClick={() => setConfirmReset(true)}>
            Erase and recover
          </button>
        )}
      </p>
    </div>
  );
}
