'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Onboarding from '@/components/Onboarding';
import Unlock from '@/components/Unlock';
import Dashboard from '@/components/Dashboard';
import { clearKeystore, loadKeystore } from '@/lib/keystore';
import { loadSession, saveSession, revokeSession, touchSession, SESSION_IDLE_MS } from '@/lib/session';
import { clearAllPending } from '@/lib/pending';
import { Signer } from '@/lib/signer';
import type { Keypair } from '@/lib/keys';
import { Button } from '@/components/ui';

const AUTO_LOCK_MS = SESSION_IDLE_MS;

type Phase = 'loading' | 'insecure' | 'unavailable' | 'corrupt' | 'onboarding' | 'locked' | 'unlocked';

export default function Wallet() {
  // 'loading' avoids hydration mismatch: localStorage exists only client-side.
  const [phase, setPhase] = useState<Phase>('loading');
  const [storageError, setStorageError] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);
  const signerRef = useRef<Signer | null>(null);
  const deadline = useRef(0);

  useEffect(() => {
    // WebCrypto needs a secure context; without it nothing can be decrypted.
    if (!window.crypto?.subtle) {
      setPhase('insecure');
      return;
    }
    const stored = loadKeystore();
    if (stored.status === 'unavailable' || stored.status === 'corrupt') {
      setStorageError(stored.reason);
      setPhase(stored.status);
      return;
    }
    if (stored.status === 'absent') {
      setPhase('onboarding');
      return;
    }
    // Refresh inside the idle window resumes the session, not the Argon2id unlock.
    let cancelled = false;
    void loadSession().then((session) => {
      if (cancelled) {
        session?.keypair.privateKey.fill(0);
        return;
      }
      if (session && Date.now() < session.lastActivity + AUTO_LOCK_MS) {
        signerRef.current = new Signer(session.keypair);
        deadline.current = session.lastActivity + AUTO_LOCK_MS;
        setPhase('unlocked');
      } else {
        session?.keypair.privateKey.fill(0);
        setPhase('locked');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const forgetKey = useCallback(() => {
    signerRef.current?.revoke();
    signerRef.current = null;
    return revokeSession();
  }, []);

  const lock = useCallback(() => {
    void forgetKey();
    setPhase('locked');
  }, [forgetKey]);

  const erase = useCallback(async () => {
    await forgetKey();
    try {
      clearKeystore();
    } catch (e) {
      setStorageError((e as Error).message);
      setPhase('unavailable');
      return;
    }
    clearAllPending();
    setConfirmErase(false);
    setPhase('onboarding');
  }, [forgetKey]);

  // Idle auto-lock from persisted activity; timers stall in hidden tabs, so the wall clock is rechecked on return.
  useEffect(() => {
    if (phase !== 'unlocked') return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      if (Date.now() >= deadline.current) lock();
      else timer = setTimeout(check, deadline.current - Date.now());
    };
    const activity = () => {
      if (Date.now() >= deadline.current) return lock();
      deadline.current = Date.now() + AUTO_LOCK_MS;
      touchSession();
      check();
    };
    const visible = () => document.visibilityState === 'visible' && check();
    check();
    const events = ['pointerdown', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, activity, true));
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, activity, true));
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
    };
  }, [phase, lock]);

  const unlocked = (keypair: Keypair) => {
    signerRef.current?.revoke();
    const signer = new Signer(keypair);
    signerRef.current = signer;
    deadline.current = Date.now() + AUTO_LOCK_MS;
    void saveSession(signer);
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
      {(phase === 'unavailable' || phase === 'corrupt') && (
        <div className="flex flex-1 flex-col justify-center pb-[9vh]">
          <div className="mx-auto w-full max-w-105 text-center">
            <h2 className="mb-2 text-[21px] font-semibold tracking-tight">
              {phase === 'corrupt' ? 'The stored wallet cannot be read' : 'Browser storage is unavailable'}
            </h2>
            <p className="mb-4 text-[13.5px] leading-relaxed text-muted">
              {phase === 'corrupt'
                ? 'The encrypted wallet record on this device is damaged or from an unsupported version. It has not been changed. Erasing it is only safe if you have your 24-word recovery phrase.'
                : 'The wallet cannot read its storage, for example in a private window or with site data blocked. Nothing was changed.'}
            </p>
            <p className="mb-4 font-mono text-[12px] text-faint">{storageError}</p>
            {phase === 'corrupt' &&
              (confirmErase ? (
                <Button variant="danger" small onClick={() => void erase()}>
                  Really erase this wallet from the device
                </Button>
              ) : (
                <Button variant="link" onClick={() => setConfirmErase(true)}>
                  Erase and recover
                </Button>
              ))}
          </div>
        </div>
      )}
      {(phase === 'onboarding' || phase === 'locked') && (
        <div className="flex flex-1 animate-gate-in flex-col justify-center pb-[9vh] motion-reduce:animate-none">
          {phase === 'onboarding' && <Onboarding onUnlocked={unlocked} />}
          {phase === 'locked' && (
            <Unlock onUnlocked={unlocked} onReset={() => void erase()} />
          )}
        </div>
      )}
      {phase === 'unlocked' && signerRef.current && (
        <Dashboard signer={signerRef.current} onLock={lock} onWalletRemoved={() => void erase()} />
      )}
    </main>
  );
}
