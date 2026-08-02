'use client';

import { useEffect, useRef, useState } from 'react';
import Onboarding from '@/components/Onboarding';
import Unlock from '@/components/Unlock';
import Dashboard from '@/components/Dashboard';
import { hasKeystore } from '@/lib/keystore';

const AUTO_LOCK_MS = 15 * 60_000;

export default function Wallet() {
  // 'loading' avoids hydration mismatch: localStorage exists only client-side.
  const [phase, setPhase] = useState('loading');
  const keypairRef = useRef(null);

  useEffect(() => {
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
    const events = ['pointerdown', 'keydown'];
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [phase]);

  const unlocked = (keypair) => {
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

      {(phase === 'onboarding' || phase === 'locked') && (
        <div className="stage-center">
          {phase === 'onboarding' && <Onboarding onUnlocked={unlocked} />}
          {phase === 'locked' && (
            <Unlock onUnlocked={unlocked} onReset={() => setPhase('onboarding')} />
          )}
        </div>
      )}
      {phase === 'unlocked' && (
        <Dashboard keypair={keypairRef.current} onLock={lock} onWalletRemoved={() => setPhase('onboarding')} />
      )}
    </main>
  );
}
