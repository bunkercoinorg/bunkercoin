import { RpcError, type BunkerConnection, type RequestOptions, type SignatureStatus } from './connection.ts';
import { transactionId, type SignedTransaction } from './keys.ts';
import { withLock } from './locks.ts';

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

export interface NoncePlan {
  nonce: bigint;
  /** Reservations the chain has settled: executed past, or finalized either way. Safe to release. */
  resolved: string[];
}

/** `statuses[i]` belongs to `ahead[i]`, the reservations at or above the chain nonce. */
export function planNonce(chainNonce: bigint, reservations: Outstanding[], statuses: (SignatureStatus | null)[]): NoncePlan {
  const ahead = reservations.filter((r) => r.nonce >= chainNonce);
  const resolved = reservations.filter((r) => r.nonce < chainNonce).map((r) => r.txId);
  ahead.forEach((r, i) => {
    if (statuses[i]?.confirmationStatus === 'finalized') resolved.push(r.txId);
  });
  const nonce = reconcileNonce(
    chainNonce,
    ahead.map((r, i) => ({ nonce: r.nonce, live: statuses[i] != null && statuses[i]!.err === null })),
  );
  return { nonce, resolved };
}

export async function nextNonce(
  conn: BunkerConnection,
  address: string,
  reservations: Outstanding[],
  opts?: RequestOptions,
): Promise<NoncePlan> {
  const chainNonce = await conn.getNonce(address, opts);
  const ahead = reservations.filter((r) => r.nonce >= chainNonce);
  const statuses = ahead.length === 0 ? [] : await conn.getSignatureStatuses(ahead.map((r) => r.txId), opts);
  return planNonce(chainNonce, reservations, statuses);
}

/** One submission at a time per account: in this tab, and across tabs where Web Locks exist. */
export const withAccountLock = <T>(address: string, fn: () => Promise<T>): Promise<T> =>
  withLock(`bunkercoin.submit.${address}`, fn);

export class BroadcastUncertainError extends Error {
  readonly txId: string;
  constructor(txId: string) {
    super(
      'No answer from the node. The transaction may have been broadcast and is listed in Activity; sending again reuses its nonce, so at most one of them can execute.',
    );
    this.txId = txId;
  }
}

/** Only an answer from the node proves the transaction was not accepted; a lost reply proves nothing. */
export function isDefiniteRejection(e: unknown): boolean {
  if (!(e instanceof RpcError)) return false;
  return e.kind === 'rpc' || (e.kind === 'http' && e.code !== null && e.code >= 400 && e.code < 500);
}

export interface BroadcastHooks {
  /** Persists the entry and its nonce reservation; runs before anything leaves the device. */
  record(txId: string): Promise<boolean>;
  rejected(txId: string): Promise<void>;
  acknowledged(localId: string, nodeId: string): Promise<void>;
}

export async function broadcast(
  conn: Pick<BunkerConnection, 'sendTransaction'>,
  tx: SignedTransaction,
  hooks: BroadcastHooks,
): Promise<{ txId: string; tracked: boolean }> {
  const txId = transactionId(tx);
  const tracked = await hooks.record(txId);
  let nodeId: string;
  try {
    nodeId = await conn.sendTransaction(tx);
  } catch (e) {
    if (!isDefiniteRejection(e)) throw new BroadcastUncertainError(txId);
    await hooks.rejected(txId);
    throw e;
  }
  await hooks.acknowledged(txId, nodeId);
  return { txId: nodeId, tracked };
}
