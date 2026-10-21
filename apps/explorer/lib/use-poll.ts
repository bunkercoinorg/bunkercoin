'use client';

import { useCallback, useEffect, useRef } from 'react';

// Single-flight polling: the next run is scheduled only after the previous one
// settles, and unmount aborts the in-flight request. `poke` runs immediately.
export function usePoll(task: (signal: AbortSignal) => Promise<void>, intervalMs: number) {
  const taskRef = useRef(task);
  const intervalRef = useRef(intervalMs);
  const pokeRef = useRef<() => void>(() => {});

  useEffect(() => {
    taskRef.current = task;
    intervalRef.current = intervalMs;
  });

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;

    const run = async () => {
      clearTimeout(timer);
      if (disposed || inFlight) return;
      inFlight = true;
      ctrl = new AbortController();
      try {
        await taskRef.current(ctrl.signal);
      } catch {
        // tasks record their own failures
      } finally {
        inFlight = false;
      }
      if (!disposed) timer = setTimeout(run, intervalRef.current);
    };

    pokeRef.current = () => void run();
    void run();
    return () => {
      disposed = true;
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, []);

  return useCallback(() => pokeRef.current(), []);
}
