'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createPoller } from './poller';

// Polls `task` every `intervalMs` while mounted; the returned callback runs it now.
export function usePoll(task: (signal: AbortSignal) => Promise<void>, intervalMs: number) {
  const taskRef = useRef(task);
  const intervalRef = useRef(intervalMs);
  const pokeRef = useRef<() => void>(() => {});

  useEffect(() => {
    taskRef.current = task;
    intervalRef.current = intervalMs;
  });

  useEffect(() => {
    const poller = createPoller((signal) => taskRef.current(signal), () => intervalRef.current);
    pokeRef.current = poller.poke;
    poller.poke();
    return () => {
      pokeRef.current = () => {};
      poller.dispose();
    };
  }, []);

  return useCallback(() => pokeRef.current(), []);
}
