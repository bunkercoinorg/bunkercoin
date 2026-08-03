'use client';

import { useState } from 'react';
import { isValidMnemonic, normalizeMnemonic } from '@/lib/keys';

export default function Recover({
  onBack,
  onValid,
}: {
  onBack: () => void;
  onValid: (phrase: string) => void;
}) {
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
