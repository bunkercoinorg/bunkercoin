'use client';

import { useState, type KeyboardEvent } from 'react';
import { Button, Field, TextInput } from '@bunkercoin/ui';

export default function PasswordField({
  id,
  label = 'password',
  value,
  onChange,
  hint,
  error,
  disabled,
  autoComplete = 'current-password',
  autoFocus,
  reveal = true,
  onEnter,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  autoComplete?: 'current-password' | 'new-password';
  autoFocus?: boolean;
  /** Repeat fields follow the first field's [show] instead of carrying their own. */
  reveal?: boolean;
  onEnter?: () => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      action={
        reveal ? (
          <Button variant="ghost" aria-pressed={shown} aria-controls={id} onClick={() => setShown((s) => !s)}>
            {shown ? 'hide' : 'show'}
          </Button>
        ) : undefined
      }
    >
      <TextInput
        type={shown ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onEnter?.()}
      />
    </Field>
  );
}
