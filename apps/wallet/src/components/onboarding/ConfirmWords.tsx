'use client';

import { useState } from 'react';
import { Button, FlowBar, WordPicker } from '@bunkercoin/ui';
import { WORDLIST } from '@/lib/keys';

interface Challenge {
  /** 1-based. */
  position: number;
  choices: string[];
}

const randomInt = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

function shuffle<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Three positions, each the right word plus two from elsewhere in the phrase and one from outside it. */
function challenges(words: string[]): Challenge[] {
  const positions = new Set<number>();
  while (positions.size < 3) positions.add(randomInt(words.length));
  const outside = WORDLIST.filter((w) => !words.includes(w));
  return [...positions]
    .sort((a, b) => a - b)
    .map((i) => {
      const inPhrase = shuffle([...new Set(words.filter((w) => w !== words[i]))]).slice(0, 2);
      return { position: i + 1, choices: shuffle([words[i], ...inPhrase, outside[randomInt(outside.length)]]) };
    });
}

function pickError(words: string[], position: number, pick: string | null): string | undefined {
  if (pick === null || pick === words[position - 1]) return undefined;
  const at = words.indexOf(pick);
  return at === -1 ? `Not word ${position}.` : `That is word ${at + 1}. Pick word ${position}.`;
}

/** W04 */
export default function ConfirmWords({ mnemonic, onBack, onNext }: { mnemonic: string; onBack: () => void; onNext: () => void }) {
  const words = mnemonic.split(' ');
  const [set] = useState(() => challenges(words));
  const [picks, setPicks] = useState<(string | null)[]>([null, null, null]);
  const done = set.every((c, i) => picks[i] === words[c.position - 1]);
  return (
    <div className="bc-col-app wl-stack wl-gap24">
      <FlowBar title="create wallet" step={[2, 4]} onBack={onBack} />
      <div>
        <h1 className="bc-t1">Confirm 3 words.</h1>
        <p className="bc-lead">Choose the word at each position.</p>
      </div>
      <div className="wl-stack wl-gap24">
        {set.map((c, i) => (
          <WordPicker
            key={c.position}
            position={c.position}
            choices={c.choices}
            value={picks[i]}
            error={pickError(words, c.position, picks[i])}
            onChange={(w) => setPicks((p) => p.map((x, k) => (k === i ? w : x)))}
          />
        ))}
      </div>
      <Button block disabled={!done} onClick={onNext}>
        continue
      </Button>
    </div>
  );
}
