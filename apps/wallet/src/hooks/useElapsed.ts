import { useEffect, useState } from 'react';

/** Seconds since `active` became true, ticking at 100ms; 0 while inactive. */
export function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(timer);
  }, [active]);
  return elapsed;
}
