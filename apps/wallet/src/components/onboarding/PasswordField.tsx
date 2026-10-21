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
  shown: shownProp,
  onShownChange,
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
  /** Repeat fields follow the first field's [show] (pass the shared `shown`) instead of carrying their own. */
  reveal?: boolean;
  shown?: boolean;
  onShownChange?: (shown: boolean) => void;
  onEnter?: () => void;
}) {
  const [own, setOwn] = useState(false);
  const shown = shownProp ?? own;
  const toggle = () => (onShownChange ?? setOwn)(!shown);
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      action={
        reveal ? (
          <Button variant="ghost" aria-pressed={shown} aria-controls={id} onClick={toggle}>
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
