import type { BunkerConnection, RequestOptions } from './connection.ts';

export interface Outstanding {
  txId: string;
  nonce: bigint;
}

/**
 * Next nonce to sign: the chain's executed nonce, advanced past our own broadcast transactions
 * that are still alive. A dropped or failed one leaves a gap, and signing resumes from it.
 */
export function reconcileNonce(chainNonce: bigint, outstanding: { nonce: bigint; live: boolean }[]): bigint {
  const live = new Set(outstanding.filter((o) => o.live && o.nonce >= chainNonce).map((o) => o.nonce));
  let next = chainNonce;
  while (live.has(next)) next++;
  return next;
}

export async function nextNonce(
  conn: BunkerConnection,
  address: string,
  outstanding: Outstanding[],
  opts?: RequestOptions,
): Promise<bigint> {
  const chainNonce = await conn.getNonce(address, opts);
  const ahead = outstanding.filter((o) => o.nonce >= chainNonce);
  if (ahead.length === 0) return chainNonce;
  const statuses = await conn.getSignatureStatuses(
    ahead.map((o) => o.txId),
    opts,
  );
  return reconcileNonce(
    chainNonce,
    ahead.map((o, i) => ({ nonce: o.nonce, live: statuses[i] !== null && statuses[i]!.err === null })),
  );
}

const tails = new Map<string, Promise<unknown>>();

/** One submission at a time per account: in this tab, and across tabs where Web Locks exist. */
export function withAccountLock<T>(address: string, fn: () => Promise<T>): Promise<T> {
  const tail = tails.get(address) ?? Promise.resolve();
  const locked = () =>
    typeof navigator !== 'undefined' && navigator.locks
      ? (navigator.locks.request(`bunkercoin.submit.${address}`, fn) as Promise<T>)
      : fn();
  const run = tail.then(locked, locked);
  const settled = run.catch(() => undefined);
  tails.set(address, settled);
  void settled.then(() => {
    if (tails.get(address) === settled) tails.delete(address);
  });
  return run;
}
