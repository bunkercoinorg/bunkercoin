'use client';

import { useState } from 'react';
import { createMnemonic } from '@/lib/keys';
import type { FinishUnlock } from '@/lib/unlock';
import Reveal from '@/components/onboarding/Reveal';
import ConfirmWords from '@/components/onboarding/ConfirmWords';
import Recover from '@/components/onboarding/Recover';
import SetPassword from '@/components/onboarding/SetPassword';
import { Button, Card, Row } from '@/components/ui';

type Step = 'choice' | 'reveal' | 'confirm' | 'recover' | 'password';

interface OnboardingProps {
  beginUnlock: () => FinishUnlock;
}

export default function Onboarding({ beginUnlock }: OnboardingProps) {
  const [step, setStep] = useState<Step>('choice');
  const [mnemonic, setMnemonic] = useState('');

  if (step === 'choice') {
    return (
      <Card
        title="Set up your wallet"
        sub="Your keys are created and stored only on this device, encrypted with a password you choose. There is no server and no account."
      >
        <Row>
          <Button
            onClick={() => {
              setMnemonic(createMnemonic());
              setStep('reveal');
            }}
          >
            Create new wallet
          </Button>
          <Button variant="ghost" onClick={() => setStep('recover')}>
            Recover existing
          </Button>
        </Row>
      </Card>
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

  return <SetPassword mnemonic={mnemonic} beginUnlock={beginUnlock} />;
}
