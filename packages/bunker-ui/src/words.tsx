'use client';

import type { ReactNode } from 'react';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Numbered recovery words. `null` mounts nothing; never copyable. */
export function WordGrid({ words, columns = 4, label = 'recovery phrase' }: { words: string[] | null; columns?: 2 | 3 | 4; label?: string }) {
  if (!words) return null;
  return (
    <ol className="bc-wg" aria-label={label} data-columns={columns} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()}>
      {words.map((w, i) => (
        <li key={i}>
          <b aria-hidden="true">{pad2(i + 1)}</b>
          {w}
        </li>
      ))}
    </ol>
  );
}

/** The hidden state before reveal: `24 words · hidden` + [show words]. */
export function WordGridHidden({ children }: { children: ReactNode }) {
  return <div className="bc-wg-hidden">{children}</div>;
}

/** Pick the word at `position` from shuffled chips; a wrong pick is outlined danger. */
export function WordPicker({
  position,
  choices,
  value,
  error,
  onChange,
}: {
  position: number;
  choices: string[];
  value: string | null;
  error?: ReactNode;
  onChange: (word: string) => void;
}) {
  const errorId = `bc-wp-${position}-error`;
  return (
    <fieldset className="bc-wp" aria-describedby={error ? errorId : undefined}>
      <legend className="bc-lbl">word {pad2(position)}</legend>
      <div className="bc-picks">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={value === c}
            data-wrong={value === c && error ? '' : undefined}
            onClick={() => onChange(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {error && (
        <p id={errorId} className="bc-err" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
