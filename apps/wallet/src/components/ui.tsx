'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

function cx(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'link';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent font-semibold text-[#041008] transition ' +
    'hover:enabled:shadow-[0_0_26px_rgba(0,255,178,0.22)] ' +
    // Dimmed mint reads as mud — disabled means visibly inert instead.
    'disabled:cursor-default disabled:border disabled:border-line disabled:bg-panel-2 disabled:text-faint',
  ghost:
    'border border-line-strong bg-transparent font-semibold text-ink transition ' +
    'hover:enabled:border-accent disabled:cursor-default disabled:opacity-40',
  danger:
    'border border-danger/30 bg-transparent font-semibold text-danger transition ' +
    'disabled:cursor-default disabled:opacity-40',
  link: 'bg-transparent p-0 font-medium text-muted underline underline-offset-3 transition hover:text-danger',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
}

export function Button({ variant = 'primary', small, className, type = 'button', ...props }: ButtonProps) {
  // Width/size live outside the variant so `small` never fights `w-full`.
  const size =
    variant === 'link'
      ? ''
      : small
        ? 'w-auto rounded-md px-3 py-1.5 text-[12.5px] font-medium'
        : `rounded-lg px-4.5 py-3 ${variant === 'danger' ? '' : 'w-full'}`;
  return <button type={type} className={cx(VARIANTS[variant], size, className)} {...props} />;
}

interface CardProps {
  title?: string;
  sub?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, sub, className, children }: CardProps) {
  return (
    <section className={cx('mb-3.5 rounded-xl border border-line bg-panel px-6 py-5.5', className)}>
      {title && (
        <h2 className="mb-2 font-mono text-[11.5px] font-medium tracking-[0.16em] uppercase text-muted">
          {title}
        </h2>
      )}
      {sub && <p className="mb-4 text-[13.5px] leading-relaxed text-muted">{sub}</p>}
      {children}
    </section>
  );
}

const FIELD =
  'w-full rounded-lg border border-line-strong bg-[#0d100e] px-3.5 py-3 text-ink outline-none transition ' +
  'focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent),0_0_30px_rgba(0,255,178,0.07)]';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(FIELD, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(FIELD, className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx(
        'mt-4 mb-1.5 block font-mono text-[10.5px] tracking-[0.14em] uppercase text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function Divider() {
  return <hr className="my-4.5 border-0 border-t border-line" />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-2.5 text-[13.5px] text-danger">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[12.5px] text-faint">{children}</p>;
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex gap-2.5 *:flex-1">{children}</div>;
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="my-3.5 rounded-lg border border-danger/25 bg-danger/5 px-3.5 py-3 text-[13px] leading-normal text-[#ffb4b1]">
      {children}
    </div>
  );
}

export function WordGrid({ words }: { words: string[] }) {
  return (
    <div className="my-4 grid grid-cols-3 gap-2 max-[480px]:grid-cols-2">
      {words.map((w, i) => (
        <span key={i} className="rounded-[7px] border border-line bg-panel-2 px-2.5 py-2 font-mono text-[13px]">
          <i className="mr-1.5 text-[10px] not-italic text-accent/70">{i + 1}</i>
          {w}
        </span>
      ))}
    </div>
  );
}
