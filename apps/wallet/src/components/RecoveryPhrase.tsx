'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, FlowBar, Panel, WordGrid, WordGridHidden } from '@bunkercoin/ui';
import { decryptMnemonic, requireKeystore } from '@/lib/keystore';
import { unlockErrorCopy } from '@/lib/unlock';
import { useElapsed } from '@/hooks/useElapsed';
import PasswordField from '@/components/onboarding/PasswordField';
import { hidesIn, useAutoHide } from '@/components/onboarding/useAutoHide';

/** W23: password every time, even unlocked. Cleared on hide, leaving the view, a hidden tab, 60s idle and lock. No copy. */
export default function RecoveryPhrase({ onBack }: { onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [words, setWords] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const elapsed = useElapsed(busy);
  const live = useRef(true);
  const attempt = useRef(0);
  useEffect(() => {
    live.current = true;
    // Backgrounding cancels a reveal still deriving, so the words never mount into a tab nobody is watching.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') attempt.current += 1;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      live.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const hide = useCallback(() => setWords(null), []);
  const left = useAutoHide(words !== null, hide);

  const reveal = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError('');
    const mine = ++attempt.current;
    try {
      const phrase = await decryptMnemonic(requireKeystore(), password);
      if (!live.current) return;
      setPassword('');
      if (attempt.current !== mine || document.visibilityState !== 'visible') {
        setError('Hidden because the tab went to the background. Enter the password again.');
        return;
      }
      setWords(phrase.split(' '));
    } catch (e) {
      if (live.current) setError(unlockErrorCopy(e));
    } finally {
      if (live.current) setBusy(false);
    }
  };

  return (
    <div className="bc-col-app wl-stack wl-gap24">
      <FlowBar title="recovery phrase" onBack={onBack} />
      {words ? (
        <Panel
          title="recovery phrase"
          meta={hidesIn(left)}
          actions={
            <Button variant="ghost" size="sm" onClick={hide}>
              hide
            </Button>
          }
          flush
        >
          <WordGrid words={words} />
        </Panel>
      ) : (
        <>
          <WordGridHidden>
            <span className="bc-small">24 words · hidden</span>
          </WordGridHidden>
          <PasswordField
            id="phrase-password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setError('');
            }}
            error={error}
            disabled={busy}
            autoFocus
            onEnter={() => void reveal()}
          />
          <Button block busy={busy} disabled={!busy && !password} onClick={() => void reveal()}>
            {busy ? `deriving key ${elapsed.toFixed(1)}s` : 'show words'}
          </Button>
        </>
      )}
    </div>
  );
}
