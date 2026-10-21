'use client';

import { useCallback, useEffect, useState } from 'react';
import { decryptMnemonic, requireKeystore } from '@/lib/keystore';
import { copySensitive } from '@/lib/clipboard';
import { Button, Card, Divider, ErrorText, Input, Row, Warn, WordGrid } from '@/components/ui';

export default function RecoveryPhrase() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const hide = useCallback(() => {
    setPhrase('');
    setPassword('');
    setOpen(false);
    setError('');
  }, []);

  // The phrase must never sit on screen unattended.
  useEffect(() => {
    if (!phrase) return;
    const timer = setTimeout(() => hide(), 60_000);
    return () => clearTimeout(timer);
  }, [phrase, hide]);

  const reveal = async () => {
    setBusy(true);
    setError('');
    try {
      setPhrase(await decryptMnemonic(requireKeystore(), password));
      setPassword('');
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'Incorrect password' ? 'Incorrect password.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Recovery phrase">
      {!open && !phrase && (
        <>
          <p className="mb-4 text-[13.5px] leading-relaxed text-muted">
            View or copy the 24 words this wallet was created with.
          </p>
          <Button variant="ghost" small onClick={() => setOpen(true)}>
            Show recovery phrase…
          </Button>
        </>
      )}
      {open && !phrase && (
        <>
          <p className="mb-4 text-[13.5px] leading-relaxed text-muted">
            Enter your password to decrypt the phrase.
          </p>
          <Input
            type="password"
            value={password}
            autoFocus
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && password && !busy && reveal()}
          />
          {error && <ErrorText>{error}</ErrorText>}
          {busy && (
            <div className="mt-3 flex items-center gap-2.5 text-[13.5px] text-muted">
              <span className="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-line-strong border-t-accent" />
              Checking your password — a few seconds…
            </div>
          )}
          <Divider />
          <Row>
            <Button variant="ghost" disabled={busy} onClick={hide}>
              Cancel
            </Button>
            <Button disabled={busy || !password} onClick={reveal}>
              Reveal
            </Button>
          </Row>
        </>
      )}
      {phrase && (
        <>
          <Warn>
            Anyone with these words controls your funds. Hide them as soon as you are done — they
            disappear automatically after a minute, and a copied phrase is cleared from the clipboard
            after 30 seconds.
          </Warn>
          <WordGrid words={phrase.split(' ')} />
          <Row>
            <Button
              variant="ghost"
              onClick={async () => {
                await copySensitive(phrase);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={hide}>Hide</Button>
          </Row>
        </>
      )}
    </Card>
  );
}
