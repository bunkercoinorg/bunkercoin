'use client';

import { useEffect, useRef, useState } from 'react';
import Onboarding from '@/components/Onboarding';
import Unlock from '@/components/Unlock';
import Dashboard from '@/components/Dashboard';
import { hasKeystore } from '@/lib/keystore';
import type { Keypair } from '@/lib/keys';

const AUTO_LOCK_MS = 15 * 60_000;

type Phase = 'loading' | 'insecure' | 'onboarding' | 'locked' | 'unlocked';

export default function Wallet() {
  // 'loading' avoids hydration mismatch: localStorage exists only client-side.
  const [phase, setPhase] = useState<Phase>('loading');
  const keypairRef = useRef<Keypair | null>(null);

  useEffect(() => {
    // WebCrypto only exists in secure contexts — without it nothing can be
    // encrypted or decrypted, so stop at the door with directions.
    if (!window.crypto?.subtle) {
      setPhase('insecure');
      return;
    }
    setPhase(hasKeystore() ? 'locked' : 'onboarding');
  }, []);

  const lock = () => {
    keypairRef.current = null; // decrypted key lives only while unlocked
    setPhase('locked');
  };

  // Idle auto-lock: an unlocked key should not outlive a forgotten tab.
  useEffect(() => {
    if (phase !== 'unlocked') return;
    let timer = setTimeout(lock, AUTO_LOCK_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, AUTO_LOCK_MS);
    };
    const events = ['pointerdown', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [phase]);

  const unlocked = (keypair: Keypair) => {
    keypairRef.current = keypair;
    setPhase('unlocked');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-155 flex-col px-6 pb-18">
      <div className="mb-7 flex items-center gap-2.5 border-b border-line py-5.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bunker-favicon.png" alt="" width={22} height={22} className="block rounded-[5px]" />
        <h1 className="text-[15px] font-semibold tracking-[0.01em]">
          Bunker<span className="text-accent">Coin</span> Wallet
        </h1>
        <span className="ml-auto rounded-full border border-line px-2.5 py-[3px] font-mono text-[10.5px] tracking-[0.14em] uppercase text-muted">
          testnet
        </span>
      </div>

      {phase === 'insecure' && (
        <div className="flex flex-1 flex-col justify-center pb-[9vh]">
          <div className="mx-auto w-full max-w-105 text-center">
            <h2 className="mb-2 text-[21px] font-semibold tracking-tight">
              Open the wallet over a secure connection
            </h2>
            <p className="text-[13.5px] leading-relaxed text-muted">
              Your browser disables encryption on plain http addresses, so the wallet cannot
              protect your keys here. Use the https address (or localhost during development).
            </p>
          </div>
        </div>
      )}
      {(phase === 'onboarding' || phase === 'locked') && (
        <div className="flex flex-1 animate-gate-in flex-col justify-center pb-[9vh] motion-reduce:animate-none">
          {phase === 'onboarding' && <Onboarding onUnlocked={unlocked} />}
          {phase === 'locked' && (
            <Unlock onUnlocked={unlocked} onReset={() => setPhase('onboarding')} />
          )}
        </div>
      )}
      {phase === 'unlocked' && keypairRef.current && (
        <Dashboard
          keypair={keypairRef.current}
          onLock={lock}
          onWalletRemoved={() => setPhase('onboarding')}
        />
      )}
    </main>
  );
}
