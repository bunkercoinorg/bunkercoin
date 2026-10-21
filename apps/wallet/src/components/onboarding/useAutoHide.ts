import { useEffect, useRef, useState } from 'react';

export const HIDE_AFTER_MS = 60_000;

/**
 * While `active`, calls `hide` after 60s without a tap or key, or as soon as the tab is hidden.
 * Returns the seconds left for the `hides in 0:52` meta.
 */
export function useAutoHide(active: boolean, hide: () => void): number {
  const [left, setLeft] = useState(HIDE_AFTER_MS / 1000);
  const hideRef = useRef(hide);
  hideRef.current = hide;
  useEffect(() => {
    if (!active) return;
    let deadline = Date.now() + HIDE_AFTER_MS;
    const tick = () => {
      const ms = deadline - Date.now();
      if (ms <= 0) hideRef.current();
      else setLeft(Math.ceil(ms / 1000));
    };
    const activity = () => {
      deadline = Date.now() + HIDE_AFTER_MS;
      tick();
    };
    const visibility = () => document.visibilityState === 'hidden' && hideRef.current();
    const leave = () => hideRef.current();
    tick();
    const timer = setInterval(tick, 1000);
    const events = ['pointerdown', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, activity, true));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, activity, true));
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave);
    };
  }, [active]);
  return left;
}

export const hidesIn = (seconds: number) => `hides in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
