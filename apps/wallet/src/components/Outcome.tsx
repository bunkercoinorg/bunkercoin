'use client';

import { Button, ButtonLink, CopyValue, formatDuration, Notice, StatusTag, StepList } from '@bunkercoin/ui';
import { base58ToBytes, bytesToHex, formatUnits, relativeAge } from '@bunkercoin/chain-format';
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
        The chain rejected it: <span className="mono text-fg">{reason}</span>. Nothing moved.
      </p>
      <Button onClick={onRetry}>edit and retry</Button>
    </section>
  );
}

/** W14-W16: what happened to one broadcast, read live from the tracker; never offers a second send while unknown. */
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
  const now = Date.now();
  const { txId } = sent;
  const entry = state.pending.find((p) => p.txId === txId);
  const finalAt = state.finalized.get(txId);
  const home = () => actions.go('#home');

  if (finalAt !== undefined) {
    const onChain = state.history?.transactions.find((t) => hexToBase58(t.hash) === txId);
    return (
      <div className="wl-stack wl-gap32">
        <div className="bc-ctr pt-4">
          <StatusTag status="finalized" />
          <h1 className="bc-t1">{copy.done}</h1>
          <p className="bc-lead">{copy.lead}</p>
          <p className="bc-hint mono">
            {onChain && `slot ${formatUnits(onChain.slot, 0)} · `}
            {formatDuration(finalAt - sent.acceptedAt)} · <CopyValue value={txId} label="transaction" />
          </p>
        </div>
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

  if (entry?.state === 'unconfirmed') {
    return (
      <section className="bc-ctr pt-4">
        <StatusTag status="unconfirmed" />
        <h1 className="bc-t2">{copy.sending}</h1>
        <p className="bc-small">Unconfirmed after 15 minutes. It may still finalize. Checking every minute.</p>
        <Button variant="ghost" onClick={home}>
          done
        </Button>
      </section>
    );
  }

  const waited = Math.max(0, now - sent.acceptedAt);
  return (
    <div className="wl-stack wl-gap24">
      <div className="bc-ctr pt-4">
        <StatusTag status="confirming" detail={relativeAge(sent.acceptedAt, now)} />
        <h1 className="bc-t1">{copy.sending}</h1>
        <p className="bc-hint mono">{copy.line} · you can close this page</p>
      </div>
      {!sent.tracked && (
        <Notice tone="warn" title="Accepted.">
          Tracking could not be saved. Keep this id: <CopyValue value={txId} mode="full" label="transaction" />
        </Notice>
      )}
      <StepList
        steps={[
          { label: 'signed', state: 'done', ms: sent.signedMs },
          {
            label: (
              <>
                accepted <span className="text-dim">·</span> <CopyValue value={txId} label="transaction" />
              </>
            ),
            state: 'done',
            ms: sent.acceptedMs,
          },
          { label: 'waiting for finality', state: 'active', ms: waited },
        ]}
      />
      <Button variant="ghost" block onClick={home}>
        done
      </Button>
    </div>
  );
}
