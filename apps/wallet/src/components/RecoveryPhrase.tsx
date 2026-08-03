'use client';

import { useCallback, useEffect, useState } from 'react';
import { decryptMnemonic, loadKeystore } from '@/lib/keystore';
import { copyText } from '@/lib/clipboard';

export default function RecoveryPhrase() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const hide = useCallback(() => {
    setPhrase('');
    setPassword('');
    setOpen(false);
    setError('');
  }, []);

  // The phrase must never sit on screen unattended.
  useEffect(() => {
    if (!phrase) return;
    const timer = setTimeout(() => hide(), 60_000);
    return () => clearTimeout(timer);
  }, [phrase, hide]);

  const reveal = async () => {
    setBusy(true);
    setError('');
    try {
      setPhrase(await decryptMnemonic(loadKeystore(), password));
      setPassword('');
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'Incorrect password' ? 'Incorrect password.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Recovery phrase</h2>
      {!open && !phrase && (
        <>
          <p className="sub">View or copy the 24 words this wallet was created with.</p>
          <button className="btn-ghost btn-small" onClick={() => setOpen(true)}>
            Show recovery phrase…
          </button>
        </>
      )}
      {open && !phrase && (
        <>
          <p className="sub">Enter your password to decrypt the phrase.</p>
          <input
            type="password"
            value={password}
            autoFocus
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && password && !busy && reveal()}
          />
          {error && <p className="error">{error}</p>}
          {busy && (
            <div className="progress">
              <span className="spinner" />
              Checking your password — a few seconds…
            </div>
          )}
          <hr className="divider" />
          <div className="row">
            <button className="btn-ghost" disabled={busy} onClick={hide}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy || !password} onClick={reveal}>
              Reveal
            </button>
          </div>
        </>
      )}
      {phrase && (
        <>
          <div className="warn">
            Anyone with these words controls your funds. Hide them as soon as you are done — they
            disappear automatically after a minute.
          </div>
          <div className="words">
            {phrase.split(' ').map((w, i) => (
              <span className="word" key={i}>
                <i>{i + 1}</i>
                {w}
              </span>
            ))}
          </div>
          <div className="row">
            <button
              className="btn-ghost"
              onClick={async () => {
                await copyText(phrase);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn-primary" onClick={hide}>
              Hide
            </button>
          </div>
        </>
      )}
    </div>
  );
}
