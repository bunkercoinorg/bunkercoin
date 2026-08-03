'use client';

import { useState } from 'react';
import { copyText } from '@/lib/clipboard';

export default function Reveal({ mnemonic, onNext }: { mnemonic: string; onNext: () => void }) {
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
