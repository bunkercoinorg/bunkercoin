'use client';

import {
  cloneElement,
  isValidElement,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link, type LinkProps } from './link.tsx';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'danger-solid' | 'quiet';

type ButtonLook = { variant?: ButtonVariant; size?: 'md' | 'sm'; block?: boolean; iconOnly?: boolean };

const look = ({ variant = 'primary', size = 'md', block, iconOnly }: ButtonLook) => ({
  'data-variant': variant,
  'data-size': size === 'sm' ? 'sm' : undefined,
  'data-block': block ? '' : undefined,
  'data-icon-only': iconOnly ? '' : undefined,
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonLook & {
    /** Keeps the width of the idle label; the caller swaps the label (`encrypting…`). No spinner. */
    busy?: boolean;
  };

/** 44px (md) / 32px (sm). Disabled renders dashed. Busy stacks the hidden idle label under the busy one, so the width holds without inline styles. */
export function Button({ variant, size, block, iconOnly, busy, type = 'button', className, onClick, children, ...rest }: ButtonProps) {
  const idle = useRef<ReactNode>(children);
  if (!busy) idle.current = children;
  return (
    <button
      type={type}
      className={className ? `bc-btn ${className}` : 'bc-btn'}
      aria-busy={busy || undefined}
      onClick={busy ? (e) => e.preventDefault() : onClick}
      {...look({ variant, size, block, iconOnly })}
      {...rest}
    >
      {busy ? (
        <span className="bc-btn-st">
          <span aria-hidden="true">{idle.current}</span>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** A link that looks like a button (`view in explorer ↗` as quiet). */
export function ButtonLink({ variant, size, block, iconOnly, className, ...rest }: LinkProps & ButtonLook) {
  return <Link className={className ? `bc-btn ${className}` : 'bc-btn'} {...look({ variant, size, block, iconOnly })} {...rest} />;
}

/** Button row; on phones it stacks full width with the primary last. */
export function Actions({ children, align }: { children: ReactNode; align?: 'start' | 'end' }) {
  return (
    <div className="bc-acts" data-align={align}>
      {children}
    </div>
  );
}

export type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Right of the label, e.g. `18 / 24 words`. */
  meta?: ReactNode;
  /** Joined to the control's right edge: [show], paste icon, unit suffix. */
  action?: ReactNode;
  /** `role="alert"` on the error; turn off for errors that update while typing. */
  announce?: boolean;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
};

/** Label + control + hint/error, wired with htmlFor/id, aria-describedby and aria-invalid. */
export function Field({ id, label, hint, error, meta, action, announce = true, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
    : children;
  return (
    <div className="bc-f">
      <div className="bc-f-h">
        <label htmlFor={id}>{label}</label>
        {meta && <span className="bc-hint mono">{meta}</span>}
      </div>
      {action ? (
        <div className="bc-ig">
          {control}
          {action}
        </div>
      ) : (
        control
      )}
      {hint && (
        <p id={hintId} className="bc-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="bc-err" role={announce ? 'alert' : undefined}>
          {error}
        </p>
      )}
    </div>
  );
}

type Mono = { mono?: boolean };

/** 44px, `--control` border, 16px text (no iOS zoom). */
export function TextInput({ mono, className, type = 'text', ...rest }: InputHTMLAttributes<HTMLInputElement> & Mono) {
  return <input type={type} className={className ? `bc-inp ${className}` : 'bc-inp'} data-mono={mono ? '' : undefined} {...rest} />;
}

export function Textarea({ mono, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & Mono) {
  return <textarea className={className ? `bc-inp ${className}` : 'bc-inp'} data-mono={mono ? '' : undefined} {...rest} />;
}

/** Suffix cell joined to an input inside Field `action` (`BUNKER`). */
export function InputSuffix({ children }: { children: ReactNode }) {
  return <span className="bc-sfx">{children}</span>;
}

export type SelectOption = { value: string; label: string; meta?: string };

export function Select({
  options,
  value,
  onChange,
  className,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & { options: SelectOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <select className={className ? `bc-inp ${className}` : 'bc-inp'} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.meta ? `${o.label} · ${o.meta}` : o.label}
        </option>
      ))}
    </select>
  );
}

/** 18px square in a 44px row; a real checkbox underneath. */
export function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="bc-chk" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export type SegmentedOption<T extends string> = { value: T; label: string };

/** Toggle group: `aria-pressed`, selected = fg fill. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="bc-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type ThemeChoice = 'system' | 'light' | 'dark';

const THEME_OPTIONS: SegmentedOption<ThemeChoice>[] = [
  { value: 'system', label: 'system' },
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
];

export function ThemeControl({ value, onChange }: { value: ThemeChoice; onChange: (value: ThemeChoice) => void }) {
  return <Segmented label="theme" options={THEME_OPTIONS} value={value} onChange={onChange} />;
}
