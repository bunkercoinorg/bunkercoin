import bs58 from 'bs58';
import {
  encodeTransaction,
  RpcError,
  type BunkerConnection,
  type RequestOptions,
  type SignatureStatus,
} from './connection.ts';
import { shortAddress } from './format.ts';
import { addressToHex, toHex, transactionId, type SignedTransaction } from './keys.ts';
import { withLock } from './locks.ts';
import {
  addEntry,
  addReservation,
  isUnresolvedLegacy,
  patchEntry,
  patchReservation,
  releaseReservations,
  removeEntry,
  transitionEntry,
  type PendingTx,
  type Reservation,
} from './pending.ts';

export interface Outstanding {
  txId: string;
  nonce: bigint;
  /** Broadcast without an acknowledgement: nothing new is signed until it settles. */
  uncertain?: boolean;
  wire?: string;
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

export interface Blocker {
  entry: Outstanding;
  status: SignatureStatus | null;
}

export interface NoncePlan {
  nonce: bigint;
  /** Reservations the chain has settled: executed past, or finalized either way. Safe to release. */
  resolved: string[];
  /** Unacknowledged broadcasts still able to execute. While any exist, `nonce` must not be signed. */
  blocked: Blocker[];
}

/** `statuses[i]` belongs to `ahead[i]`, the reservations at or above the chain nonce. */
export function planNonce(chainNonce: bigint, reservations: Outstanding[], statuses: (SignatureStatus | null)[]): NoncePlan {
  const ahead = reservations.filter((r) => r.nonce >= chainNonce);
  const resolved = reservations.filter((r) => r.nonce < chainNonce).map((r) => r.txId);
  const blocked: Blocker[] = [];
  ahead.forEach((r, i) => {
    const status = statuses[i] ?? null;
    if (status?.confirmationStatus === 'finalized') resolved.push(r.txId);
    else if (r.uncertain && (status === null || status.err === null)) blocked.push({ entry: r, status });
  });
  const nonce = reconcileNonce(
    chainNonce,
    ahead.map((r, i) => ({ nonce: r.nonce, live: statuses[i] != null && statuses[i]!.err === null })),
  );
  return { nonce, resolved, blocked };
}

/** Reservations merged with Activity entries; either one marking a broadcast unacknowledged makes it uncertain. */
export function collectOutstanding(reservations: Reservation[], entries: PendingTx[]): Outstanding[] {
  const known = new Map<string, Outstanding>();
  for (const r of reservations) known.set(r.txId, { txId: r.txId, nonce: r.nonce, uncertain: r.uncertain, wire: r.wire });
  for (const p of entries) {
    if (p.nonce === null || p.state === 'failed') continue;
    const r = known.get(p.txId);
    const uncertain = p.state === 'uncertain' || r?.uncertain === true;
    known.set(p.txId, { txId: p.txId, nonce: p.nonce, uncertain, wire: r?.wire });
  }
  return [...known.values()];
}

export async function nextNonce(
  conn: Pick<BunkerConnection, 'getNonce' | 'getSignatureStatuses'>,
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
      'No answer from the node. The transaction may have been broadcast and is listed in Activity; sending again resends that same transaction instead of signing a new one.',
    );
    this.txId = txId;
  }
}

/** A new transaction was refused because an earlier one may still execute. */
export class SendBlockedError extends Error {
  readonly txId: string;
  constructor(txId: string, message: string) {
    super(message);
    this.txId = txId;
  }
}

/** Only an answer from the node proves the transaction was not accepted; a lost reply proves nothing. */
export function isDefiniteRejection(e: unknown): boolean {
  if (!(e instanceof RpcError)) return false;
  return e.kind === 'rpc' || (e.kind === 'http' && e.code !== null && e.code >= 400 && e.code < 500);
}

/** The node answers a resend of a transaction it already holds with a conflict: that is an acknowledgement. */
function alreadyHeld(e: unknown): boolean {
  return e instanceof RpcError && e.kind === 'rpc' && /already in mempool/i.test(e.message);
}

type SendOutcome = { kind: 'acknowledged'; nodeId: string } | { kind: 'rejected'; error: Error } | { kind: 'uncertain' };

async function send(conn: Pick<BunkerConnection, 'sendRawTransaction'>, wire: string, txId: string): Promise<SendOutcome> {
  try {
    return { kind: 'acknowledged', nodeId: await conn.sendRawTransaction(wire) };
  } catch (e) {
    if (alreadyHeld(e)) return { kind: 'acknowledged', nodeId: txId };
    if (isDefiniteRejection(e)) return { kind: 'rejected', error: e as Error };
    return { kind: 'uncertain' };
  }
}

export interface BroadcastHooks {
  /** Persists the entry and its nonce reservation with the exact payload; runs before anything leaves the device. */
  record(txId: string, wire: string): Promise<boolean>;
  rejected(txId: string): Promise<void>;
  acknowledged(localId: string, nodeId: string): Promise<void>;
}

export async function broadcast(
  conn: Pick<BunkerConnection, 'sendRawTransaction'>,
  tx: SignedTransaction,
  hooks: BroadcastHooks,
): Promise<{ txId: string; tracked: boolean }> {
  const txId = transactionId(tx);
  const wire = encodeTransaction(tx);
  const tracked = await hooks.record(txId, wire);
  const out = await send(conn, wire, txId);
  if (out.kind === 'uncertain') throw new BroadcastUncertainError(txId);
  if (out.kind === 'rejected') {
    await hooks.rejected(txId);
    throw out.error;
  }
  await hooks.acknowledged(txId, out.nodeId);
  return { txId: out.nodeId, tracked };
}

export type Submission = Pick<PendingTx, 'kind' | 'amount' | 'to' | 'ticker'>;

/** One account's chain access and persisted tracking. Callers hold `withAccountLock` around every use. */
export interface Account {
  conn: Pick<BunkerConnection, 'getNonce' | 'getSignatureStatuses' | 'sendRawTransaction' | 'getTransaction'>;
  address: string;
  reservations(): Reservation[];
  entries(): PendingTx[];
  reserve(op: (list: Reservation[]) => Reservation[]): Promise<boolean>;
  apply(op: (list: PendingTx[]) => PendingTx[]): Promise<boolean>;
  track(entry: PendingTx): void;
  untrack(txId: string): void;
}

function settle(account: Account, txId: string, nonce: bigint, entry: PendingTx | undefined) {
  return {
    rejected: async () => {
      account.untrack(txId);
      await account.apply(removeEntry(txId));
      await account.reserve(releaseReservations([txId]));
    },
    acknowledged: async (nodeId: string) => {
      if (nodeId === txId) {
        await account.reserve(patchReservation(txId, { uncertain: false }));
        await account.apply(patchEntry(txId, { state: 'pending' }));
        return;
      }
      // The node is authoritative for the id; keep the nonce reserved under both until one resolves.
      account.untrack(txId);
      const acked = patchReservation(txId, { uncertain: false });
      await account.reserve((list) => addReservation({ txId: nodeId, nonce, at: Date.now(), uncertain: false })(acked(list)));
      if (!entry) return;
      const moved: PendingTx = { ...entry, txId: nodeId, state: 'pending' };
      await account.apply((list) => addEntry(moved)(removeEntry(txId)(list)));
      account.track(moved);
    },
  };
}

async function plan(account: Account): Promise<NoncePlan> {
  const p = await nextNonce(account.conn, account.address, collectOutstanding(account.reservations(), account.entries()));
  if (p.resolved.length > 0) await account.reserve(releaseReservations(p.resolved));
  return p;
}

/** Seen by the node: wait for it to settle. Unseen: resend exactly the bytes that were signed. */
async function settleBlocked(account: Account, { entry: o, status }: Blocker): Promise<string> {
  const id = shortAddress(o.txId, 6);
  if (status !== null) {
    await account.apply(transitionEntry(o.txId, 'uncertain', 'pending'));
    return `The earlier transaction ${id} reached the network without an acknowledgement. Sending is paused until it finalizes or fails, so it cannot execute twice.`;
  }
  if (!o.wire) {
    return `The earlier transaction ${id} has no answer from the node and cannot be resent from this device. Sending is paused until it settles.`;
  }
  const out = await send(account.conn, o.wire, o.txId);
  const s = settle(account, o.txId, o.nonce, account.entries().find((p) => p.txId === o.txId));
  if (out.kind === 'acknowledged') {
    await s.acknowledged(out.nodeId);
    return `The earlier transaction ${id} was resent unchanged and the node accepted it. Nothing new was signed; check Activity before sending again.`;
  }
  if (out.kind === 'rejected') {
    await s.rejected();
    return `The earlier transaction ${id} was resent unchanged and the node rejected it (${out.error.message}). Nothing new was signed; you can send again.`;
  }
  return `The earlier transaction ${id} still has no answer from the node; it was resent unchanged. Sending is paused until it settles, so it cannot execute twice.`;
}

/** Gives v1 entries their nonce from the node. Returns the first one that stays unknown, which blocks signing. */
async function resolveLegacy(account: Account): Promise<PendingTx | null> {
  const meHex = addressToHex(account.address);
  for (const p of account.entries().filter(isUnresolvedLegacy)) {
    let found;
    try {
      found = await account.conn.getTransaction(toHex(bs58.decode(p.txId)));
    } catch {
      return p;
    }
    if (found.location === 'finalized' || (found.sender !== account.address && found.sender !== meHex)) continue;
    await account.reserve(addReservation({ txId: p.txId, nonce: found.nonce, at: p.at, uncertain: false }));
    await account.apply(patchEntry(p.txId, { nonce: found.nonce }));
  }
  return null;
}

/**
 * Signs and broadcasts one transaction. While an earlier broadcast's outcome is unknown nothing is signed: that
 * one is resent unchanged instead and the call fails with SendBlockedError, so a retry can never execute twice.
 */
export async function submitTransaction(
  account: Account,
  build: (nonce: bigint) => SignedTransaction,
  info: Submission,
): Promise<{ txId: string; tracked: boolean }> {
  const legacy = await resolveLegacy(account);
  if (legacy) {
    throw new SendBlockedError(
      legacy.txId,
      `A transaction from before this wallet update (${shortAddress(legacy.txId, 6)}) is still settling. Sending is paused until it finalizes or fails.`,
    );
  }
  const { nonce, blocked } = await plan(account);
  if (blocked.length > 0) {
    const messages: string[] = [];
    for (const b of blocked) messages.push(await settleBlocked(account, b));
    throw new SendBlockedError(blocked[0].entry.txId, messages[0]);
  }
  const tx = build(nonce);
  let recorded: PendingTx | undefined;
  return broadcast(account.conn, tx, {
    record: async (txId, wire) => {
      recorded = { ...info, txId, nonce, at: Date.now(), state: 'uncertain' };
      const reserved = await account.reserve(addReservation({ txId, nonce, at: Date.now(), uncertain: true, wire }));
      const tracked = await account.apply(addEntry(recorded));
      account.track(recorded);
      return reserved && tracked;
    },
    rejected: (txId) => settle(account, txId, nonce, recorded).rejected(),
    acknowledged: (txId, nodeId) => settle(account, txId, nonce, recorded).acknowledged(nodeId),
  });
}

/** Resends an unacknowledged broadcast if the node still has not seen it; returns what happened, for display. */
export async function resendUncertain(account: Account, txId: string): Promise<string | null> {
  const blocker = (await plan(account)).blocked.find((b) => b.entry.txId === txId);
  return blocker ? settleBlocked(account, blocker) : null;
}
