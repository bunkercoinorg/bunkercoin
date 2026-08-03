'use client';

import { useState } from 'react';
import { keypairFromMnemonic, type Keypair } from '@/lib/keys';
import { encryptMnemonic, saveKeystore } from '@/lib/keystore';
import { useElapsed } from '@/hooks/useElapsed';
import KdfProgress from '@/components/KdfProgress';

const MIN_PASSWORD = 8;

interface SetPasswordProps {
  mnemonic: string;
  onUnlocked: (keypair: Keypair) => void;
}

export default function SetPassword({ mnemonic, onUnlocked }: SetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
    try {
      // Deliberately slow (Argon2id): this cost is what a thief pays per guess.
      const record = await encryptMnemonic(mnemonic, password);
      saveKeystore(record);
      onUnlocked(keypairFromMnemonic(mnemonic));
    } catch (e) {
      setError((e as Error).message || 'Encryption failed');
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Choose a password</h2>
      <p className="sub">
        It encrypts your recovery phrase on this device. You will need it every time you open the
        wallet — it cannot be reset, only re-created from the 24 words.
      </p>
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
      <label>Repeat password</label>
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={busy}
        onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
      />
      {error && <p className="error">{error}</p>}
      {busy ? (
        <KdfProgress label="Encrypting your recovery phrase" elapsed={elapsed} />
      ) : (
        <>
          <hr className="divider" />
          <button className="btn-primary" disabled={!password || !confirm} onClick={submit}>
            Encrypt and finish
          </button>
        </>
      )}
    </div>
  );
}
