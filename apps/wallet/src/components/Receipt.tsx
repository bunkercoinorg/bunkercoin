'use client';

import type { ReactNode } from 'react';
import { Actions, Button, CopyValue, Facts, Notice, Panel, type Fact } from '@bunkercoin/ui';
import { utcClock } from '@bunkercoin/chain-format';
import type { NoncePlan } from '@/lib/submit';
import type { ReviewedFee } from '@/hooks/useReview';
import { bunker } from '@/components/assets';

/** The signed receipt (W12/W13/W19): exactly the values that get signed, frozen, plus the fee actually fetched. */
export default function Receipt({
  rows,
  fee,
  total,
  plan,
  planError,
  footLabel,
  address,
  busy,
  error,
  signLabel,
  busyLabel,
  onEdit,
  onSign,
  onCheck,
  onRetryPlan,
}: {
  rows: Fact[];
  fee: ReviewedFee;
  /** Native sends only: the bold total row. */
  total?: bigint;
  plan: NoncePlan | null;
  planError: string;
  footLabel: 'from' | 'creator';
  address: string;
  busy: boolean;
  error: ReactNode;
  signLabel: string;
  busyLabel: string;
  onEdit: () => void;
  onSign: () => void;
  onCheck: (txId: string) => void;
  onRetryPlan: () => void;
}) {
  const blocked = plan?.blocked[0] ?? null;
  const feeRow: Fact = {
    label: 'network fee',
    value: (
      <>
        {bunker(fee.fee)} BUNKER <span className="bc-s">· {fee.was !== null ? `was ${bunker(fee.was)}` : utcClock(fee.at)}</span>
      </>
    ),
    changed: fee.was !== null,
  };
  const items = [...rows, feeRow];
  if (total !== undefined) items.push({ label: 'total', value: `${bunker(total)} BUNKER`, strong: true });
  return (
    <div className="wl-stack wl-gap24">
      {fee.was !== null && (
        <Notice tone="warn" title="Fee changed." role="alert">
          {bunker(fee.was)} → {bunker(fee.fee)} BUNKER. Review again.
        </Notice>
      )}
      {blocked && (
        <Notice
          tone="warn"
          role="alert"
          action={
            <Button variant="ghost" size="sm" onClick={() => onCheck(blocked.entry.txId)}>
              check status
            </Button>
          }
        >
          Nonce {blocked.entry.nonce.toString()} is still unconfirmed. Another send could be rejected.
        </Notice>
      )}
      {planError && (
        <Notice
          tone="error"
          action={
            <Button variant="ghost" size="sm" onClick={onRetryPlan}>
              retry
            </Button>
          }
        >
          Nonce unavailable: {planError}
        </Notice>
      )}
      <Panel
        tone="receipt"
        title="review before signing"
        meta={plan ? `nonce ${plan.nonce}` : 'nonce …'}
        footer={
          <span className="bc-hint mono bc-grow">
            {footLabel} <CopyValue value={address} label={footLabel === 'from' ? 'sender' : 'creator'} />
          </span>
        }
      >
        <Facts variant="rows" items={items} />
      </Panel>
      {error && (
        <p className="bc-err" role="alert">
          {error}
        </p>
      )}
      <Actions align="end">
        <Button variant="ghost" onClick={onEdit} disabled={busy}>
          edit
        </Button>
        <Button onClick={onSign} busy={busy} disabled={!plan || blocked !== null}>
          {busy ? busyLabel : signLabel}
        </Button>
      </Actions>
    </div>
  );
}
