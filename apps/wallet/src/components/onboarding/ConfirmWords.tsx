'use client';

import { useMemo, useState } from 'react';

interface ConfirmWordsProps {
  mnemonic: string;
  onBack: () => void;
  onNext: () => void;
}

export default function ConfirmWords({ mnemonic, onBack, onNext }: ConfirmWordsProps) {
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
