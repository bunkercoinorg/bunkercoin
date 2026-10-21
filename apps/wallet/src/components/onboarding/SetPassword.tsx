'use client';

import { useRef, useState } from 'react';
import { Button, FlowBar, Notice, StepList, type Step } from '@bunkercoin/ui';
import { keypairFromMnemonic, type Keypair } from '@/lib/keys';
import type { FinishUnlock } from '@/lib/unlock';
import { setupErrorCopy } from '@/lib/unlock';
import { encryptMnemonic, keystoreFingerprint, rememberAddress, replaceKeystore, saveKeystore, type KeystoreRecord } from '@/lib/keystore';
import { useElapsed } from '@/hooks/useElapsed';
import PasswordField from '@/components/onboarding/PasswordField';

const MIN_PASSWORD = 8;

type Stage = 'derive' | 'encrypt' | 'save';

export interface Saved {
  keypair: Keypair;
  record: KeystoreRecord;
  finish: FinishUnlock;
}

/** W05. Deliberately slow (Argon2id in a worker): this cost is what a thief pays per guess. */
export default function SetPassword({
  mnemonic,
  beginUnlock,
  replacing,
  flow,
  step,
  onBack,
  onSaved,
}: {
  mnemonic: string;
  beginUnlock: () => FinishUnlock;
  /** The stored text the user agreed to replace; null saves into an empty slot only. */
  replacing: string | null;
  flow: string;
  step: [number, number];
  onBack: () => void;
  onSaved: (saved: Saved) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; save?: string }>({});
  const [stage, setStage] = useState<Stage | null>(null);
  const [fallback, setFallback] = useState(false);
  const deriveMs = useRef(0);
  const elapsed = useElapsed(stage === 'derive');
  const busy = stage !== null;

  const submit = async () => {
    if (busy) return;
    if (password.length < MIN_PASSWORD) return setErrors({ password: 'Use at least 8 characters.' });
    if (password !== confirm) return setErrors({ confirm: "Passwords don't match." });
    setErrors({});
    setFallback(false);
    setStage('derive');
    const started = Date.now();
    const finish = beginUnlock();
    try {
      const record = await encryptMnemonic(mnemonic, password, undefined, {
        onFallback: () => setFallback(true),
        onDerived: () => {
          deriveMs.current = Date.now() - started;
          setStage('encrypt');
        },
      });
      setStage('save');
      if (replacing === null) await saveKeystore(record, finish.current);
      else await replaceKeystore(record, replacing, finish.current);
      const keypair = keypairFromMnemonic(mnemonic);
      rememberAddress(keystoreFingerprint(record), keypair.address);
      onSaved({ keypair, record, finish });
    } catch (e) {
      setErrors({ save: setupErrorCopy(e) });
      setStage(null);
    }
  };

  const order: Stage[] = ['derive', 'encrypt', 'save'];
  const state = (s: Stage): Step['state'] => (stage === null ? 'pending' : order.indexOf(s) < order.indexOf(stage) ? 'done' : s === stage ? 'active' : 'pending');
  const steps: Step[] = [
    {
      label: 'deriving key',
      state: state('derive'),
      ms: stage === 'derive' ? elapsed * 1000 : deriveMs.current,
      detail: fallback ? 'The background worker did not answer; this tab may freeze until it finishes.' : undefined,
    },
    { label: 'encrypting phrase', state: state('encrypt') },
    { label: 'saving to this browser', state: state('save') },
  ];

  return (
    <div className="bc-col-app wl-stack wl-gap24">
      <FlowBar title={flow} step={step} onBack={busy ? undefined : onBack} />
      <div>
        <h1 className="bc-t1">Set a password.</h1>
        <p className="bc-lead">The password unlocks this browser&apos;s copy. The 24 words restore the wallet.</p>
      </div>
      <div className="wl-stack wl-gap16">
        <PasswordField
          id="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErrors({});
          }}
          hint="8 characters or more."
          error={errors.password}
          autoComplete="new-password"
          disabled={busy}
          autoFocus
        />
        <PasswordField
          id="repeat-password"
          label="repeat password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setErrors({});
          }}
          error={errors.confirm}
          autoComplete="new-password"
          disabled={busy}
          reveal={false}
          onEnter={() => void submit()}
        />
      </div>
      {errors.save && <Notice tone="error">{errors.save}</Notice>}
      <Button block busy={busy} disabled={!busy && (!password || !confirm)} onClick={() => void submit()}>
        {busy ? 'encrypting…' : 'continue'}
      </Button>
      {busy && <StepList steps={steps} />}
    </div>
  );
}
