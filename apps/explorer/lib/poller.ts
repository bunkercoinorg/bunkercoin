export interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Poller {
  poke: () => void;
  dispose: () => void;
}

// Single-flight polling: the next run is scheduled only after the previous one
// settles, `poke` runs now unless a run is in flight, and `dispose` aborts it.
export function createPoller(
  task: (signal: AbortSignal) => Promise<void>,
  intervalMs: () => number,
  timers: Timers = realTimers,
): Poller {
  let disposed = false;
  let inFlight = false;
  let timer: unknown;
  let ctrl: AbortController | null = null;

  const run = async () => {
    timers.clear(timer);
    if (disposed || inFlight) return;
    inFlight = true;
    ctrl = new AbortController();
    try {
      await task(ctrl.signal);
    } catch {
      // tasks record their own failures
    } finally {
      inFlight = false;
    }
    if (!disposed) timer = timers.set(run, intervalMs());
  };

  return {
    poke: () => void run(),
    dispose: () => {
      disposed = true;
      timers.clear(timer);
      ctrl?.abort();
    },
  };
}
