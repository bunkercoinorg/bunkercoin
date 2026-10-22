'use client';

import { useEffect, useRef, useState } from 'react';
import { BrandMark, Button, Choice, ChoiceList, CopyValue, FlowBar, Notice, Tag } from '@bunkercoin/ui';
import { createMnemonic } from '@/lib/keys';
import { keystoreFingerprint, readKeystoreRaw, rememberedAddress, validateRecord } from '@/lib/keystore';
import { CHANGED_MEANWHILE, type FinishUnlock } from '@/lib/unlock';
import Reveal from '@/components/onboarding/Reveal';
import ConfirmWords from '@/components/onboarding/ConfirmWords';
import Import, { type Replacing } from '@/components/onboarding/Import';
import SetPassword, { type Saved } from '@/components/onboarding/SetPassword';

type Step = 'welcome' | 'reveal' | 'confirm' | 'password' | 'ready' | 'import' | 'import-password';

export interface OnboardingProps {
  beginUnlock: () => FinishUnlock;
  /** 'import' opens W07 directly, keeping any saved record until the user confirms replacing it. */
  mode?: 'welcome' | 'import';
  /** Back from the first step; without it, import returns to W01. */
  onCancel?: () => void;
}

/** What import would replace: the stored text as it is now, and its address if this browser knows it. */
function savedRecord(): Replacing | null {
  let raw: string | null;
  try {
    raw = readKeystoreRaw();
  } catch {
    return null;
  }
  if (raw === null) return null;
  let address: string | null = null;
  try {
    address = rememberedAddress(keystoreFingerprint(validateRecord(JSON.parse(raw))));
  } catch {
    // An unreadable record has no known address.
  }
  return { raw, address };
}

export default function Onboarding({ beginUnlock, mode = 'welcome', onCancel }: OnboardingProps) {
  const [step, setStep] = useState<Step>(mode === 'import' ? 'import' : 'welcome');
  const [mnemonic, setMnemonic] = useState('');
  const [replacing, setReplacing] = useState<Replacing | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState('');
  const savedRef = useRef<Saved | null>(null);
  savedRef.current = saved;

  useEffect(() => {
    if (step === 'import') setReplacing(savedRecord());
  }, [step]);

  // A saved but never opened wallet must not leave its key in memory.
  useEffect(
    () => () => {
      savedRef.current?.keypair.privateKey.fill(0);
    },
    [],
  );

  const open = (s: Saved) => {
    savedRef.current = null;
    setSaved(null);
    if (!s.finish(s.keypair, s.record)) setError(CHANGED_MEANWHILE);
  };

  const back = () => (onCancel ? onCancel() : setStep('welcome'));

  if (step === 'welcome') {
    return (
      <div className="mx-auto w-full max-w-[480px] wl-stack wl-gap32">
        <div className="bc-ctr pt-6">
          <BrandMark size={48} />
          <h1 className="bc-t1">BunkerCoin wallet.</h1>
          <p className="bc-lead">Keys stay in this browser.</p>
        </div>
        <ChoiceList>
          <Choice
            icon="plus"
            title="create a wallet"
            line="New 24-word recovery phrase."
            primary
            onClick={() => {
              setMnemonic(createMnemonic());
              setStep('reveal');
            }}
          />
          <Choice icon="receive" title="import a wallet" line="Enter your existing 24 words." onClick={() => setStep('import')} />
        </ChoiceList>
      </div>
    );
  }

  if (step === 'reveal') {
    return (
      <Reveal
        mnemonic={mnemonic}
        onBack={() => {
          setMnemonic('');
          back();
        }}
        onNext={() => setStep('confirm')}
      />
    );
  }

  if (step === 'confirm') return <ConfirmWords mnemonic={mnemonic} onBack={() => setStep('reveal')} onNext={() => setStep('password')} />;

  if (step === 'import') {
    return (
      <Import
        replacing={replacing}
        onBack={back}
        onValid={(phrase) => {
          setMnemonic(phrase);
          setStep('import-password');
        }}
      />
    );
  }

  if (step === 'password' || step === 'import-password') {
    const importing = step === 'import-password';
    return (
      <SetPassword
        mnemonic={mnemonic}
        beginUnlock={beginUnlock}
        replacing={importing ? (replacing?.raw ?? null) : null}
        flow={importing ? 'import wallet' : 'create wallet'}
        step={importing ? [2, 2] : [3, 4]}
        onBack={() => setStep(importing ? 'import' : 'confirm')}
        onSaved={(s) => {
          setMnemonic('');
          if (importing) open(s);
          else {
            setSaved(s);
            setStep('ready');
          }
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[480px] wl-stack wl-gap32">
      <FlowBar title="create wallet" step={[4, 4]} />
      <div className="bc-ctr">
        <Tag state="final">saved</Tag>
        <h1 className="bc-t1">Wallet ready.</h1>
        {saved && (
          <p>
            <CopyValue value={saved.keypair.address} label="address" />
          </p>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button block disabled={!saved} onClick={() => saved && open(saved)}>
        open wallet
      </Button>
    </div>
  );
}
