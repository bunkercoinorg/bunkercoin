const tails = new Map<string, Promise<unknown>>();

/** Runs `fn` exclusively per name: queued in this tab, and across tabs where Web Locks exist. */
export function withLock<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
  const tail = tails.get(name) ?? Promise.resolve();
  const locked = async (): Promise<T> =>
    typeof navigator !== 'undefined' && navigator.locks ? ((await navigator.locks.request(name, async () => fn())) as T) : fn();
  const run = tail.then(locked, locked);
  const settled = run.catch(() => undefined);
  tails.set(name, settled);
  void settled.then(() => {
    if (tails.get(name) === settled) tails.delete(name);
  });
  return run;
}
