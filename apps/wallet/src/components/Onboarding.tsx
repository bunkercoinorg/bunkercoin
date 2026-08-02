'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
  keypairFromMnemonic,
  type Keypair,
} from '@/lib/keys';
import { encryptMnemonic, saveKeystore } from '@/lib/keystore';
import { copyText } from '@/lib/clipboard';

const MIN_PASSWORD = 8;

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

function Reveal({ mnemonic, onNext }: { mnemonic: string; onNext: () => void }) {
  const [copied, setCopied] = useState(false);
  const words = mnemonic.split(' ');
  return (
    <div className="card">
      <h2>Your recovery phrase</h2>
      <p className="sub">
        These 24 words are the only way to recover your wallet. Write them down in order and keep
        them offline.
      </p>
      <div className="warn">
        Anyone with these words controls your funds. They are never sent anywhere and cannot be
        shown again after setup.
      </div>
      <div className="words">
        {words.map((w, i) => (
          <span className="word" key={i}>
            <i>{i + 1}</i>
            {w}
          </span>
        ))}
      </div>
      <div className="row">
        <button
          className="btn-ghost"
          onClick={async () => {
            await copyText(mnemonic);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="btn-primary" onClick={onNext}>
          I wrote them down
        </button>
      </div>
    </div>
  );
}

function ConfirmWords({
  mnemonic,
  onBack,
  onNext,
}: {
  mnemonic: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const words = mnemonic.split(' ');
  // Three positions to prove they actually saved the phrase.
  const positions = useMemo(() => {
    const set = new Set<number>();
    while (set.size < 3) set.add(Math.floor(Math.random() * 24));
    return [...set].sort((a, b) => a - b);
  }, []);
  const [answers, setAnswers] = useState(['', '', '']);
  const [error, setError] = useState('');

  const check = () => {
    const ok = positions.every((p, i) => answers[i].trim().toLowerCase() === words[p]);
    if (!ok) {
      setError('One or more words do not match. Check your notes.');
      return;
    }
    onNext();
  };

  return (
    <div className="card">
      <h2>Confirm your phrase</h2>
      <p className="sub">Enter the requested words from your notes.</p>
      {positions.map((p, i) => (
        <div key={p}>
          <label>Word #{p + 1}</label>
          <input
            value={answers[i]}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => {
              const next = [...answers];
              next[i] = e.target.value;
              setAnswers(next);
              setError('');
            }}
          />
        </div>
      ))}
      {error && <p className="error">{error}</p>}
      <hr className="divider" />
      <div className="row">
        <button className="btn-ghost" onClick={onBack}>
          Show phrase again
        </button>
        <button className="btn-primary" disabled={answers.some((a) => !a.trim())} onClick={check}>
          Continue
        </button>
      </div>
    </div>
  );
}

function Recover({ onBack, onValid }: { onBack: () => void; onValid: (phrase: string) => void }) {
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const normalized = normalizeMnemonic(phrase);
    if (normalized.split(' ').length !== 24) {
      setError('A recovery phrase has exactly 24 words.');
      return;
    }
    if (!isValidMnemonic(normalized)) {
      setError('That is not a valid recovery phrase — check for typos.');
      return;
    }
    onValid(normalized);
  };
  return (
    <div className="card">
      <h2>Recover a wallet</h2>
      <p className="sub">Enter your 24-word recovery phrase, separated by spaces.</p>
      <textarea
        rows={4}
        value={phrase}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setPhrase(e.target.value);
          setError('');
        }}
      />
      {error && <p className="error">{error}</p>}
      <hr className="divider" />
      <div className="row">
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn-primary" disabled={!phrase.trim()} onClick={submit}>
          Continue
        </button>
      </div>
    </div>
  );
}

function SetPassword({ mnemonic, onUnlocked }: { mnemonic: string; onUnlocked: (kp: Keypair) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(timer);
  }, [busy]);

  const submit = async () => {
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Deliberately slow (Argon2id): this cost is what a thief pays per guess.
      const record = await encryptMnemonic(mnemonic, password);
      saveKeystore(record);
      onUnlocked(keypairFromMnemonic(mnemonic));
    } catch (e) {
      setError((e as Error).message || 'Encryption failed');
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Choose a password</h2>
      <p className="sub">
        It encrypts your recovery phrase on this device. You will need it every time you open the
        wallet — it cannot be reset, only re-created from the 24 words.
      </p>
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
      <label>Repeat password</label>
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={busy}
        onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
      />
      {error && <p className="error">{error}</p>}
      {busy ? (
        <div className="kdf" role="status" aria-live="polite">
          <div className="kdf-track">
            <div className="kdf-bar" />
          </div>
          <div className="kdf-line">
            <span>Encrypting your recovery phrase</span>
            <span className="t">{elapsed.toFixed(1)}s</span>
          </div>
        </div>
      ) : (
        <>
          <hr className="divider" />
          <button className="btn-primary" disabled={!password || !confirm} onClick={submit}>
            Encrypt and finish
          </button>
        </>
      )}
    </div>
  );
}
