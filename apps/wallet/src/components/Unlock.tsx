'use client';

import { useEffect, useState } from 'react';
import { BrandMark, Button, StepList } from '@bunkercoin/ui';
import { decryptMnemonic, keystoreFingerprint, rememberAddress, requireKeystore } from '@/lib/keystore';
import { keypairFromMnemonic } from '@/lib/keys';
import { loadAutoLockMinutes, type AutoLockMinutes } from '@/lib/session';
import { CHANGED_MEANWHILE, unlockErrorCopy, type FinishUnlock } from '@/lib/unlock';
import { useElapsed } from '@/hooks/useElapsed';
import Onboarding from '@/components/Onboarding';
import PasswordField from '@/components/onboarding/PasswordField';

export type LockReason = 'idle' | 'signing' | null;

export interface UnlockProps {
  beginUnlock: () => FinishUnlock;
  /** Unused: a forgotten password leads to import with the record kept, never to an erase. */
  onReset?: () => void;
  lockReason?: LockReason;
  /** One line on transfers still being tracked; null when none. */
  inflight?: string | null;
}

/** W08. Works offline: nothing here talks to the node. */
export default function Unlock({ beginUnlock, lockReason = null, inflight = null }: UnlockProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [minutes, setMinutes] = useState<AutoLockMinutes>(15);
  const elapsed = useElapsed(busy);

  useEffect(() => setMinutes(loadAutoLockMinutes()), []);

  if (forgot) return <Onboarding beginUnlock={beginUnlock} mode="import" onCancel={() => setForgot(false)} />;

  const submit = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError('');
    setFallback(false);
    const finish = beginUnlock();
    try {
      const record = requireKeystore();
      const keypair = keypairFromMnemonic(await decryptMnemonic(record, password, { onFallback: () => setFallback(true) }));
      const address = keypair.address;
      if (!finish(keypair, record)) throw new Error(CHANGED_MEANWHILE);
      rememberAddress(keystoreFingerprint(record), address);
    } catch (e) {
      setError(unlockErrorCopy(e));
      setBusy(false);
    }
  };

  const reason =
    lockReason === 'idle' ? `Locked after ${minutes} min idle.` : lockReason === 'signing' ? 'Locked before signing. Nothing was sent.' : null;

  return (
    <div className="mx-auto w-full max-w-[420px] wl-stack wl-gap24">
      <div className="bc-ctr pt-6">
        <BrandMark size={48} />
        <h1 className="bc-t1">Unlock.</h1>
        {reason && <p className="bc-hint mono">{reason}</p>}
        {inflight && (
          <p className="wl-inflight-line bc-hint mono" role="status">
            {inflight}
          </p>
        )}
      </div>
      <PasswordField
        id="unlock-password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError('');
        }}
        error={error}
        disabled={busy}
        autoFocus
        onEnter={() => void submit()}
      />
      <Button block busy={busy} disabled={!busy && !password} onClick={() => void submit()}>
        {busy ? 'unlocking…' : 'unlock'}
      </Button>
      {busy && (
        <StepList
          steps={[
            {
              label: 'deriving key',
              state: 'active',
              ms: elapsed * 1000,
              detail: fallback ? 'The background worker did not answer; this tab may freeze until it finishes.' : undefined,
            },
          ]}
        />
      )}
      <div className="text-center">
        <Button variant="quiet" disabled={busy} onClick={() => setForgot(true)}>
          forgot password
        </Button>
      </div>
    </div>
  );
}
