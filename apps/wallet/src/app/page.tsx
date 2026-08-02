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
    <main className="shell">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bunker-favicon.png" alt="" width={22} height={22} />
        <h1>
          Bunker<span>Coin</span> Wallet
        </h1>
        <span className="tag">testnet</span>
      </div>

      {phase === 'insecure' && (
        <div className="stage-center">
          <div className="card gate">
            <h2>Open the wallet over a secure connection</h2>
            <p className="sub">
              Your browser disables encryption on plain http addresses, so the wallet cannot
              protect your keys here. Use the https address (or localhost during development).
            </p>
          </div>
        </div>
      )}
      {(phase === 'onboarding' || phase === 'locked') && (
        <div className="stage-center">
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
