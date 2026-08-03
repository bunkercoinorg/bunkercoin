'use client';

import { useState } from 'react';
import { createMnemonic, type Keypair } from '@/lib/keys';
import Reveal from '@/components/onboarding/Reveal';
import ConfirmWords from '@/components/onboarding/ConfirmWords';
import Recover from '@/components/onboarding/Recover';
import SetPassword from '@/components/onboarding/SetPassword';

type Step = 'choice' | 'reveal' | 'confirm' | 'recover' | 'password';

interface OnboardingProps {
  onUnlocked: (keypair: Keypair) => void;
}

export default function Onboarding({ onUnlocked }: OnboardingProps) {
  const [step, setStep] = useState<Step>('choice');
  const [mnemonic, setMnemonic] = useState('');

  if (step === 'choice') {
    return (
      <div className="card">
        <h2>Set up your wallet</h2>
        <p className="sub">
          Your keys are created and stored only on this device, encrypted with a password you
          choose. There is no server and no account.
        </p>
        <div className="row">
          <button
            className="btn-primary"
            onClick={() => {
              setMnemonic(createMnemonic());
              setStep('reveal');
            }}
          >
            Create new wallet
          </button>
          <button className="btn-ghost" onClick={() => setStep('recover')}>
            Recover existing
          </button>
        </div>
      </div>
    );
  }

  if (step === 'reveal') {
    return <Reveal mnemonic={mnemonic} onNext={() => setStep('confirm')} />;
  }

  if (step === 'confirm') {
    return (
      <ConfirmWords mnemonic={mnemonic} onBack={() => setStep('reveal')} onNext={() => setStep('password')} />
    );
  }

  if (step === 'recover') {
    return (
      <Recover
        onBack={() => setStep('choice')}
        onValid={(phrase) => {
          setMnemonic(phrase);
          setStep('password');
        }}
      />
    );
  }

  return <SetPassword mnemonic={mnemonic} onUnlocked={onUnlocked} />;
}
