'use client';

import { useState } from 'react';
import type { ChainTransaction } from '@/lib/connection';
import { addressToHex, hexToBase58 } from '@/lib/keys';
import { formatUnits, shortAddress, elapsedLabel } from '@/lib/format';
import type { PendingTx } from '@/lib/pending';
import TxDetails from '@/components/TxDetails';

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
    <div className="card">
      <h2>Activity</h2>
      <p className="sub">
        Transactions finalize over the radio link — usually a few minutes. You can close this page;
        tracking resumes when you return.
      </p>
      {pending.map((p) => (
        <div key={p.txId}>
          <div
            className="pending-row clickable"
            onClick={() => setExpanded(expanded === p.txId ? null : p.txId)}
          >
            <span>
              {p.kind === 'faucet' ? 'Faucet' : `Send ${formatUnits(p.amount)} → ${shortAddress(p.to ?? '')}`}
              <span className="hint" style={{ marginLeft: 8 }}>
                {elapsedLabel(p.at)}
              </span>
            </span>
            {p.failed ? (
              <span className="status failed" title={p.failed}>
                failed
                <button
                  className="btn-ghost btn-small"
                  style={{ marginLeft: 6 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(p.txId);
                  }}
                >
                  ✕
                </button>
              </span>
            ) : (
              <span className="status processed">confirming…</span>
            )}
          </div>
          {expanded === p.txId && (
            <TxDetails
              rows={[
                ['Transaction id', p.txId],
                p.to ? ['To', p.to] : null,
                ['Amount', `${formatUnits(p.amount)} BUNKER`],
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
    </div>
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
      <div className="pending-row clickable" onClick={onToggle}>
        <span>
          {outgoing ? '↑ Sent' : '↓ Received'} {amountLabel}
          <span className="hint" style={{ marginLeft: 8 }}>
            {outgoing ? 'to' : 'from'} {shortAddress(counterparty)}
          </span>
        </span>
        <span className={failed ? 'status failed' : 'status finalized'} title={t.status?.error || ''}>
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
