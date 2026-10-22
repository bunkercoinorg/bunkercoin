'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell, Footer, Tag } from '@bunkercoin/ui';
import Onboarding from '@/components/Onboarding';
import Unlock from '@/components/Unlock';
import Dashboard, { EXPLORER_URL } from '@/components/Dashboard';
import { Gate } from '@/components/Gate';
import {
  clearKeystore,
  KEYSTORE_KEY,
  keystoreFingerprint,
  loadKeystore,
  type KeystoreRecord,
  type KeystoreState,
} from '@/lib/keystore';
import type { Keypair } from '@/lib/keys';
import {
  autoLockMs,
  loadAutoLockMinutes,
  loadSession,
  removeLegacySession,
  revokeSession,
  saveAutoLockMinutes,
  saveSession,
  touchSession,
  type AutoLockMinutes,
} from '@/lib/session';
import { clearAllPending } from '@/lib/pending';
import { Signer } from '@/lib/signer';
import { settleUnlock, UnlockGate, type FinishUnlock } from '@/lib/unlock';

type Phase =
  | 'loading'
  | 'insecure'
  | 'nocrypto'
  | 'unavailable'
  | 'corrupt'
  | 'import'
  | 'onboarding'
  | 'locked'
  | 'unlocked';

const CHECKING_AFTER_MS = 300;

const fingerprintOf = (state: KeystoreState) => (state.status === 'ok' ? keystoreFingerprint(state.record) : null);

const FOOTER = (
  <Footer
    links={[
      { label: 'explorer', href: EXPLORER_URL, external: true },
      { label: 'source', href: 'https://github.com/bunkercoinorg/bunkercoin', external: true },
    ]}
  >
    keys stay in this browser.
  </Footer>
);

export default function Wallet() {
  // 'loading' avoids hydration mismatch: localStorage exists only client-side.
  const [phase, setPhase] = useState<Phase>('loading');
  const [slow, setSlow] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [lockReason, setLockReason] = useState<'idle' | 'signing' | null>(null);
  const [autoLock, setAutoLock] = useState<AutoLockMinutes>(15);
  const signerRef = useRef<Signer | null>(null);
  const deadline = useRef(0);
  const autoLockRef = useRef(autoLock);
  autoLockRef.current = autoLock;
  const gate = useRef(new UnlockGate()).current;
  // The keystore record the current phase was derived from; another tab replacing it invalidates everything.
  const fingerprint = useRef<string | null>(null);

  const forgetKey = useCallback(() => {
    gate.invalidate();
    signerRef.current?.revoke();
    signerRef.current = null;
    return revokeSession();
  }, [gate]);

  const route = useCallback((state: KeystoreState) => {
    fingerprint.current = fingerprintOf(state);
    if (state.status === 'unavailable' || state.status === 'corrupt') {
      setStorageError(state.reason);
      setPhase(state.status);
    } else {
      setPhase(state.status === 'absent' ? 'onboarding' : 'locked');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), CHECKING_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // WebCrypto needs a secure context; without it nothing can be decrypted.
    if (!window.isSecureContext) {
      setPhase('insecure');
      return;
    }
    if (!window.crypto?.subtle) {
      setPhase('nocrypto');
      return;
    }
    const minutes = loadAutoLockMinutes();
    setAutoLock(minutes);
    let cancelled = false;
    const legacy = removeLegacySession();
    const stored = loadKeystore();
    if (stored.status !== 'ok') route(stored);
    else {
      const fp = keystoreFingerprint(stored.record);
      fingerprint.current = fp;
      // Refresh inside the idle window resumes the session, not the Argon2id unlock.
      void legacy
        .then(() => loadSession(fp))
        .then((session) => {
          if (cancelled || fingerprint.current !== fp) {
            session?.keypair.privateKey.fill(0);
            return;
          }
          if (session && Date.now() < session.lastActivity + autoLockMs(minutes)) {
            signerRef.current = new Signer(session.keypair);
            deadline.current = session.lastActivity + autoLockMs(minutes);
            setPhase('unlocked');
          } else {
            session?.keypair.privateKey.fill(0);
            setPhase('locked');
          }
        });
    }
    // Another tab erased, recovered or created a wallet: whatever this tab holds belongs to the old one.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEYSTORE_KEY && e.key !== null) return;
      const state = loadKeystore();
      if (state.status === 'ok' && fingerprintOf(state) === fingerprint.current) return;
      void forgetKey();
      route(state);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      gate.invalidate();
      window.removeEventListener('storage', onStorage);
    };
  }, [gate, forgetKey, route]);

  const lock = useCallback(
    (reason: 'idle' | 'signing' | null = null) => {
      void forgetKey();
      setLockReason(reason);
      setPhase('locked');
    },
    [forgetKey],
  );

  const erase = useCallback(async () => {
    await forgetKey();
    try {
      await clearKeystore();
    } catch (e) {
      setStorageError((e as Error).message);
      setPhase('unavailable');
      return;
    }
    clearAllPending();
    fingerprint.current = null;
    window.history.replaceState(null, '', window.location.pathname);
    setPhase('onboarding');
  }, [forgetKey]);

  const changeAutoLock = useCallback((m: AutoLockMinutes) => {
    saveAutoLockMinutes(m);
    setAutoLock(m);
    deadline.current = Date.now() + autoLockMs(m);
    touchSession();
  }, []);

  // Idle auto-lock from persisted activity; timers stall in hidden tabs, so the wall clock is rechecked on return.
  useEffect(() => {
    if (phase !== 'unlocked') return;
    const idleMs = autoLockMs(autoLock);
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      if (Date.now() >= deadline.current) lock('idle');
      else timer = setTimeout(check, deadline.current - Date.now());
    };
    const activity = () => {
      if (Date.now() >= deadline.current) return lock('idle');
      deadline.current = Date.now() + idleMs;
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
  }, [phase, lock, autoLock]);

  // Captured when the attempt starts, so an erase or replacement while Argon2id runs voids it.
  const beginUnlock = useCallback((): FinishUnlock => {
    const current = gate.begin();
    const finish = (keypair: Keypair, record: KeystoreRecord) => {
      const fp = keystoreFingerprint(record);
      const stored = fingerprintOf(loadKeystore());
      return settleUnlock(current() && stored === fp, keypair, (k) => {
        signerRef.current?.revoke();
        const signer = new Signer(k);
        signerRef.current = signer;
        fingerprint.current = fp;
        deadline.current = Date.now() + autoLockMs(autoLockRef.current);
        void saveSession(signer, fp);
        setLockReason(null);
        setPhase('unlocked');
      });
    };
    return Object.assign(finish, { current });
  }, [gate]);

  if (phase === 'unlocked' && signerRef.current) {
    return (
      <Dashboard
        signer={signerRef.current}
        onLock={() => lock(null)}
        onWalletRemoved={erase}
        autoLockMinutes={autoLock}
        onAutoLockChange={changeAutoLock}
      />
    );
  }

  const gateKind =
    phase === 'insecure'
      ? 'insecure'
      : phase === 'nocrypto'
        ? 'nocrypto'
        : phase === 'unavailable'
          ? 'storage'
          : phase === 'corrupt'
            ? 'unreadable'
            : phase === 'loading'
              ? 'checking'
              : null;

  return (
    <AppShell app="wallet" status={<Tag>testnet</Tag>} flow={gateKind === null} footer={FOOTER}>
      {gateKind === 'checking' ? (
        slow && <Gate kind="checking" />
      ) : gateKind ? (
        <Gate kind={gateKind} detail={storageError || undefined} onImport={gateKind === 'unreadable' ? () => setPhase('import') : undefined} />
      ) : phase === 'import' ? (
        <Onboarding beginUnlock={beginUnlock} mode="import" onCancel={() => setPhase('corrupt')} />
      ) : phase === 'onboarding' ? (
        <Onboarding beginUnlock={beginUnlock} />
      ) : (
        <Unlock beginUnlock={beginUnlock} lockReason={lockReason} />
      )}
    </AppShell>
  );
}
