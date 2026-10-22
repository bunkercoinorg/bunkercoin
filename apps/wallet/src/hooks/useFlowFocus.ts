import { useEffect, useRef } from 'react';

/** Moves focus into the new step when `step` changes: its `[data-step-focus]` control, else its h1. */
export function useFlowFocus<T extends HTMLElement>(step: unknown) {
  const root = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = root.current?.querySelector<HTMLElement>('[data-step-focus]') ?? root.current?.querySelector<HTMLElement>('h1');
    if (!el) return;
    if (el.tagName === 'H1' && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus();
  }, [step]);
  return root;
}

/** Focuses a control by id after a refused submit. */
export const focusField = (id: string) => document.getElementById(id)?.focus();
