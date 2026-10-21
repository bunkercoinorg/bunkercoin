'use client';

import { useState } from 'react';
import type { ChainTransaction } from '@/lib/connection';
import { addressToHex, hexToBase58 } from '@/lib/keys';
import { formatUnits, shortAddress, elapsedLabel } from '@/lib/format';
import type { PendingTx } from '@/lib/pending';
import TxDetails from '@/components/TxDetails';
import { Button, Card } from '@/components/ui';

const ROW =
  'flex cursor-pointer items-center justify-between border-t border-line py-3 text-sm ' +
  'hover:bg-[linear-gradient(90deg,transparent,rgba(0,255,178,0.08)_50%,transparent)]';
function pendingLabel(p: PendingTx): string {
  if (p.kind === 'faucet') return 'Faucet';
  if (p.kind === 'mint') return `Create ${p.ticker} · ${p.amount.toLocaleString()} supply`;
  if (p.kind === 'token-send')
    return `Send ${p.amount.toLocaleString()} ${p.ticker} → ${shortAddress(p.to ?? '')}`;
  return `Send ${formatUnits(p.amount)} → ${shortAddress(p.to ?? '')}`;
}

const PILL = 'rounded-full px-2 py-[3px] font-mono text-[11px] tracking-[0.04em] whitespace-nowrap';

interface ActivityProps {
  address: string;
  pending: PendingTx[];
  history: ChainTransaction[];
  onDismiss: (txId: string) => void;
}

export default function Activity({ address, pending, history, onDismiss }: ActivityProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (pending.length === 0 && history.length === 0) return null;

  return (
    <Card
      title="Activity"
      sub="Transactions finalize over the radio link — usually a few minutes. You can close this page; tracking resumes when you return."
    >
      {pending.map((p) => (
        <div key={p.txId}>
          <div className={ROW} onClick={() => setExpanded(expanded === p.txId ? null : p.txId)}>
            <span>
              {pendingLabel(p)}
              <span className="ml-2 text-[12.5px] text-faint">{elapsedLabel(p.at)}</span>
            </span>
            {p.failed ? (
              <span className={`${PILL} bg-danger/10 text-danger`} title={p.failed}>
                failed
                <Button
                  variant="ghost"
                  small
                  className="ml-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(p.txId);
                  }}
                >
                  ✕
                </Button>
              </span>
            ) : (
              <span className={`${PILL} bg-amber/10 text-amber`}>confirming…</span>
            )}
          </div>
          {expanded === p.txId && (
            <TxDetails
              rows={[
                ['Transaction id', p.txId],
                p.to ? ['To', p.to] : null,
                [
                  'Amount',
                  p.ticker ? `${p.amount.toLocaleString()} ${p.ticker}` : `${formatUnits(p.amount)} BUNKER`,
                ],
                ['Submitted', new Date(p.at).toLocaleString()],
                p.failed ? ['Error', p.failed] : null,
              ]}
            />
          )}
        </div>
      ))}
      {history.map((t) => (
        <HistoryRow
          key={t.hash}
          tx={t}
          address={address}
          expanded={expanded === t.hash}
          onToggle={() => setExpanded(expanded === t.hash ? null : t.hash)}
        />
      ))}
    </Card>
  );
}

function HistoryRow({
  tx: t,
  address,
  expanded,
  onToggle,
}: {
  tx: ChainTransaction;
  address: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const outgoing = t.sender === addressToHex(address);
  const counterparty = hexToBase58(outgoing ? t.body?.to ?? t.sender : t.sender);
  const failed = t.status?.success === false;
  const isToken = t.body?.type === 'TokenTransfer';
  const amountLabel = isToken
    ? `${(t.body?.amount ?? 0).toLocaleString()} tokens`
    : formatUnits(t.body?.amount ?? 0);

  return (
    <div>
      <div className={ROW} onClick={onToggle}>
        <span>
          {outgoing ? '↑ Sent' : '↓ Received'} {amountLabel}
          <span className="ml-2 text-[12.5px] text-faint">
            {outgoing ? 'to' : 'from'} {shortAddress(counterparty)}
          </span>
        </span>
        <span
          className={`${PILL} ${failed ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}
          title={t.status?.error || ''}
        >
          {failed ? 'failed' : '✓ finalized'}
        </span>
      </div>
      {expanded && (
        <TxDetails
          rows={[
            ['From', hexToBase58(t.sender)],
            t.body?.to ? ['To', hexToBase58(t.body.to)] : null,
            [
              'Amount',
              isToken
                ? `${(t.body?.amount ?? 0).toLocaleString()} tokens`
                : `${formatUnits(t.body?.amount ?? 0)} BUNKER`,
            ],
            ['Fee', `${formatUnits(t.fee ?? 0)} BUNKER`],
            ['Reference', t.hash],
            t.status?.error ? ['Error', String(t.status.error)] : null,
          ]}
          explorerHash={t.hash}
        />
      )}
    </div>
  );
}
