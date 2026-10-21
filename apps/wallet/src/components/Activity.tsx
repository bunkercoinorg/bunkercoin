'use client';

import { useState } from 'react';
import { tokenLabel, type AccountHistory, type ChainTransaction, type TokenBalance } from '@/lib/connection';
import { hexToBase58 } from '@/lib/keys';
import { formatCount, formatUnits, shortAddress, elapsedLabel } from '@/lib/format';
import type { PendingTx } from '@/lib/pending';
import TxDetails from '@/components/TxDetails';
import { Button, Card, Hint } from '@/components/ui';

const ROW =
  'flex items-center justify-between border-t border-line py-3 text-sm ' +
  'hover:bg-[linear-gradient(90deg,transparent,rgba(0,255,178,0.08)_50%,transparent)]';
const TOGGLE = 'flex-1 cursor-pointer bg-transparent p-0 text-left text-inherit';

function pendingLabel(p: PendingTx): string {
  if (p.kind === 'faucet') return 'Faucet';
  if (p.kind === 'mint') return `Create ${p.ticker} · ${formatCount(p.amount)} supply`;
  if (p.kind === 'token-send') return `Send ${formatCount(p.amount)} ${p.ticker} → ${shortAddress(p.to ?? '')}`;
  return `Send ${formatUnits(p.amount)} → ${shortAddress(p.to ?? '')}`;
}

const PILL = 'rounded-full px-2 py-[3px] font-mono text-[11px] tracking-[0.04em] whitespace-nowrap';

interface ActivityProps {
  addressHex: string;
  pending: PendingTx[];
  history: AccountHistory | null;
  tokens: TokenBalance[];
  trackingLost: boolean;
  historyError: string | null;
  onDismiss: (txId: string) => void;
}

export default function Activity({ addressHex, pending, history, historyError, tokens, trackingLost, onDismiss }: ActivityProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const txs = history?.transactions ?? [];

  const truncated = history?.end === 'scan-limit';
  if (pending.length === 0 && txs.length === 0 && !trackingLost && !truncated && !historyError) return null;

  const tickers = new Map(tokens.map((t) => [t.tokenId, tokenLabel(t)]));

  return (
    <Card
      title="Activity"
      sub="Transactions finalize over the radio link — usually a few minutes. You can close this page; tracking resumes when you return."
    >
      {pending.map((p) => (
        <div key={p.txId}>
          <div className={ROW}>
            <button
              type="button"
              className={TOGGLE}
              aria-expanded={expanded === p.txId}
              onClick={() => setExpanded(expanded === p.txId ? null : p.txId)}
            >
              {pendingLabel(p)}
              <span className="ml-2 text-[12.5px] text-faint">{elapsedLabel(p.at)}</span>
            </button>
            {p.state === 'pending' ? (
              <span className={`${PILL} bg-amber/10 text-amber`}>confirming…</span>
            ) : (
              <span
                className={`${PILL} ${p.state === 'failed' ? 'bg-danger/10 text-danger' : 'bg-amber/10 text-amber'}`}
                title={
                  p.state === 'failed'
                    ? p.error
                    : p.state === 'uncertain'
                      ? 'The node did not acknowledge this broadcast. Still checking whether it arrived.'
                      : 'No confirmation yet. Still checking every minute.'
                }
              >
                {p.state === 'failed' ? 'failed' : p.state === 'uncertain' ? 'no answer from node' : 'unconfirmed'}
                <Button
                  variant="ghost"
                  small
                  className="ml-1.5"
                  aria-label="Dismiss"
                  onClick={() => onDismiss(p.txId)}
                >
                  ✕
                </Button>
              </span>
            )}
          </div>
          {expanded === p.txId && (
            <TxDetails
              rows={[
                ['Transaction id', p.txId],
                p.to ? ['To', p.to] : null,
                ['Amount', p.ticker ? `${formatCount(p.amount)} ${p.ticker}` : `${formatUnits(p.amount)} BUNKER`],
                ['Submitted', new Date(p.at).toLocaleString()],
                p.state === 'unconfirmed' ? ['Status', 'Not confirmed yet; it may still finalize'] : null,
                p.state === 'uncertain' ? ['Status', 'Broadcast not acknowledged; it may still have reached the network'] : null,
                p.error ? ['Error', p.error] : null,
              ]}
            />
          )}
        </div>
      ))}
      {txs.map((t) => (
        <HistoryRow
          key={t.hash}
          tx={t}
          addressHex={addressHex}
          tickers={tickers}
          expanded={expanded === t.hash}
          onToggle={() => setExpanded(expanded === t.hash ? null : t.hash)}
        />
      ))}
      {historyError && <Hint>History could not be loaded: {historyError}</Hint>}
      {trackingLost && <Hint>Tracking could not be saved on this device; open transactions will not be followed after a reload.</Hint>}
      {history?.end === 'enough' && <Hint>Showing your latest {txs.length} transactions; older ones are not listed.</Hint>}
      {history && truncated && (
        <Hint>
          {txs.length === 0 ? 'No activity for this wallet' : 'Showing your activity'} among the latest{' '}
          {history.scanned.toLocaleString('en-US')} network transactions; older activity is not listed.
        </Hint>
      )}
    </Card>
  );
}

interface Described {
  title: string;
  sub: string | null;
  to: string | null;
  amount: string | null;
}

function describe(t: ChainTransaction, addressHex: string, tickers: Map<string, string>): Described {
  const outgoing = t.sender === addressHex;
  const body = t.body;
  if (body.type === 'Transfer' || body.type === 'TokenTransfer') {
    const value =
      body.type === 'Transfer'
        ? `${formatUnits(body.amount)} BUNKER`
        : `${formatCount(body.amount)} ${tickers.get(body.tokenId) ?? `token ${body.tokenId}`}`;
    const counterparty = hexToBase58(outgoing ? body.to : t.sender);
    return {
      title: `${outgoing ? '↑ Sent' : '↓ Received'} ${value}`,
      sub: `${outgoing ? 'to' : 'from'} ${shortAddress(counterparty)}`,
      to: hexToBase58(body.to),
      amount: value,
    };
  }
  if (body.type === 'Mint') {
    return { title: `Created ${body.ticker} · ${formatCount(body.maxSupply)} supply`, sub: null, to: null, amount: null };
  }
  if (body.type === 'Burn') {
    const value = `${formatCount(body.amount)} ${tickers.get(body.tokenId) ?? `token ${body.tokenId}`}`;
    return { title: `Burned ${value}`, sub: null, to: null, amount: value };
  }
  return { title: `${body.name} transaction`, sub: null, to: null, amount: null };
}

function HistoryRow({
  tx: t,
  addressHex,
  tickers,
  expanded,
  onToggle,
}: {
  tx: ChainTransaction;
  addressHex: string;
  tickers: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const d = describe(t, addressHex, tickers);
  const { outcome } = t;
  const pill =
    outcome.kind === 'success'
      ? { cls: 'bg-accent/10 text-accent', text: '✓ finalized' }
      : outcome.kind === 'failed'
        ? { cls: 'bg-danger/10 text-danger', text: 'failed' }
        : { cls: 'bg-amber/10 text-amber', text: 'outcome unknown' };

  return (
    <div>
      <div className={ROW}>
        <button type="button" className={TOGGLE} aria-expanded={expanded} onClick={onToggle}>
          {d.title}
          {d.sub && <span className="ml-2 text-[12.5px] text-faint">{d.sub}</span>}
        </button>
        <span className={`${PILL} ${pill.cls}`} title={outcome.kind === 'failed' ? (outcome.error ?? '') : ''}>
          {pill.text}
        </span>
      </div>
      {expanded && (
        <TxDetails
          rows={[
            ['From', hexToBase58(t.sender)],
            d.to ? ['To', d.to] : null,
            d.amount ? ['Amount', d.amount] : null,
            ['Fee', `${formatUnits(t.fee)} BUNKER`],
            ['Reference', t.hash],
            outcome.kind === 'failed' && outcome.error ? ['Error', outcome.error] : null,
          ]}
          explorerHash={t.hash}
        />
      )}
    </div>
  );
}
