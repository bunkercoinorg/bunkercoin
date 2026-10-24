'use client';

import { Button, ButtonLink, CopyValue, formatDuration, Notice, StatusTag, Tag } from '@bunkercoin/ui';
import { base58ToBytes, bytesToHex, formatUnits } from '@bunkercoin/chain-format';
import { phaseLabel } from '@/lib/inflight';
import { hexToBase58 } from '@/lib/keys';
import { EXPLORER_URL, type WalletActions, type WalletState } from '@/components/Dashboard';

export interface Broadcast {
  txId: string;
  tracked: boolean;
  signedMs: number;
  acceptedMs: number;
  acceptedAt: number;
}

export interface OutcomeCopy {
  /** `Sending 12.500000 BUNKER.` */
  sending: string;
  /** Headline once the node acknowledged it, before finality; `sending` when absent. */
  sent?: string;
  /** `Sent.` */
  done: string;
  /** `12.500000 BUNKER to 2ndb…ZMTa` */
  lead: string;
  /** `to 2ndb…ZMTa` */
  line: string;
}

export const explorerTx = (txId: string) => {
  const bytes = base58ToBytes(txId);
  return `${EXPLORER_URL}/tx?sig=${bytes ? bytesToHex(bytes) : txId}`;
};

export function Rejected({ reason, onRetry, title = 'Not sent.' }: { reason: string; onRetry: () => void; title?: string }) {
  return (
    <section className="bc-ctr pt-4">
      <StatusTag status="failed" />
      <h1 className="bc-t1">{title}</h1>
      <p className="bc-small">
        The chain rejected it: <span className="mono text-fg">{reason.replace(/^[A-Za-z]+: /, '').replace(/\.$/, '')}</span>. Nothing moved.
      </p>
      <Button onClick={onRetry}>edit and retry</Button>
    </section>
  );
}

/** W14-W16: ends the flow as soon as the node acknowledged it; the tracker carries on from Activity. Never offers a second send while unknown. */
export default function Outcome({
  sent,
  copy,
  state,
  actions,
  onRetry,
  kind = 'Send',
}: {
  sent: Broadcast;
  copy: OutcomeCopy;
  state: WalletState;
  actions: WalletActions;
  onRetry: () => void;
  kind?: string;
}) {
  const { txId } = sent;
  const entry = state.pending.find((p) => p.txId === txId);
  const finalAt = state.finalized.get(txId);
  const home = () => actions.go('#home');

  const onChain = state.history?.transactions.find((t) => hexToBase58(t.hash) === txId);
  const executedError = onChain?.outcome.kind === 'failed' ? (onChain.outcome.error ?? 'unknown reason') : entry?.executed ? (entry.error ?? 'unknown reason') : null;
  if (executedError !== null) {
    return (
      <section className="bc-ctr pt-4">
        <span className="bc-row justify-center">
          {onChain && <StatusTag status="finalized" />}
          <StatusTag status="failed" />
        </span>
        <h1 className="bc-t1">Failed on chain.</h1>
        <p className="bc-small">
          It executed and failed: <span className="mono text-fg">{executedError.replace(/^[A-Za-z ]+: /, '').replace(/\.$/, '')}</span>. The fee was spent;
          nothing else moved.
        </p>
        <div className="bc-acts justify-center">
          <Button onClick={onRetry}>edit and retry</Button>
          <ButtonLink variant="quiet" href={explorerTx(txId)} external>
            view in explorer ↗
          </ButtonLink>
        </div>
      </section>
    );
  }

  if (entry?.state === 'failed') return <Rejected reason={entry.error ?? 'unknown reason'} onRetry={onRetry} />;

  if (entry?.state === 'uncertain') {
    return (
      <section className="bc-ctr pt-4">
        <StatusTag status="unknown" />
        <h1 className="bc-t2">{kind} outcome unknown.</h1>
        <p className="bc-small">The node timed out after submission. Don&apos;t send again yet.</p>
        {entry.error && <p className="bc-hint">{entry.error}</p>}
        <div className="bc-acts justify-center">
          <Button variant="ghost" onClick={() => actions.recheck(txId)}>
            check status
          </Button>
          <Button variant="quiet" onClick={home}>
            done
          </Button>
        </div>
      </section>
    );
  }

  const final = finalAt !== undefined || onChain?.outcome.kind === 'success';
  return (
    <div className="wl-stack wl-gap32">
      <div className="bc-ctr pt-4">
        {final ? (
          <StatusTag status="finalized" />
        ) : (
          <Tag state="pending">{entry ? phaseLabel(entry) : 'sent · waiting for a block'}</Tag>
        )}
        <h1 className="bc-t1">{final ? copy.done : (copy.sent ?? copy.sending)}</h1>
        <p className="bc-lead">{copy.lead}</p>
        {final ? (
          <p className="bc-hint mono">
            {onChain && `slot ${formatUnits(onChain.slot, 0)} · `}
            {finalAt !== undefined && `${formatDuration(finalAt - sent.acceptedAt)} · `}
            <CopyValue value={txId} label="transaction" />
          </p>
        ) : (
          <>
            <p className="bc-small">
              It lands in the next blocks; you can close this.{state.cadence && ` Finality ${state.cadence}.`}
            </p>
            <p className="bc-hint mono">
              <CopyValue value={txId} label="transaction" />
            </p>
          </>
        )}
      </div>
      {!sent.tracked && (
        <Notice tone="warn" title="Accepted.">
          Tracking could not be saved. Keep this id: <CopyValue value={txId} mode="full" label="transaction" />
        </Notice>
      )}
      <div className="grid justify-items-center gap-3">
        <Button block onClick={home}>
          done
        </Button>
        <ButtonLink variant="quiet" href={explorerTx(txId)} external>
          view in explorer ↗
        </ButtonLink>
      </div>
    </div>
  );
}
