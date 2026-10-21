'use client';

import { Actions, Amount, Button, ButtonLink, CopyValue, Disclosure, Facts, FlowBar, StatePanel, StatusTag, type Fact } from '@bunkercoin/ui';
import { relativeAge, utcClock } from '@bunkercoin/chain-format';
import { viewHref } from '@/hooks/useHashView';
import { useActivity, itemTag } from '@/components/Activity';
import { isOpen } from '@/components/activity-model';
import { bunker } from '@/components/assets';
import { explorerTx } from '@/components/Outcome';
import type { WalletActions, WalletState } from '@/components/Dashboard';

export default function TxDetails({ txId, state, actions }: { txId: string; state: WalletState; actions: WalletActions }) {
  const item = useActivity(state).find((i) => i.id === txId);
  const back = () => actions.go(viewHref('activity'));
  const now = Date.now();
  if (!item) {
    const done = state.finalized.has(txId);
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="transaction" onBack={back} />
        <StatePanel
          state={done ? 'empty' : 'notfound'}
          heading="h1"
          title={done ? 'Finalized.' : 'Transaction not in this wallet.'}
          message={done ? 'It is no longer in the recent scan.' : 'Not among open transactions or the latest network scan.'}
          id={txId}
          actions={
            <ButtonLink variant="ghost" href={explorerTx(txId)} external>
              explorer ↗
            </ButtonLink>
          }
        />
      </div>
    );
  }
  const open = isOpen(item.status);
  const checked = item.pending ? state.checkedAt.get(item.id) : state.fresh.history.okAt;
  const execution =
    item.status === 'final' || item.status === 'final-unknown'
      ? item.status === 'final'
        ? 'succeeded'
        : 'not reported yet'
      : item.status === 'final-failed' || item.status === 'failed'
        ? `failed: ${item.error ?? 'unknown reason'}`
        : 'not reported yet';
  const key: Fact[] = [];
  if (item.counterparty) key.push({ label: item.counterparty.label, value: <CopyValue value={item.counterparty.address} label={item.counterparty.label === 'to' ? 'recipient' : 'sender'} /> });
  const fee = item.fee ?? item.pending?.fee ?? null;
  if (fee !== null) key.push({ label: 'fee', value: `${bunker(fee)} BUNKER` });
  key.push({ label: 'transaction', value: <CopyValue value={item.id} label="transaction" /> });
  const details: Fact[] = [];
  if (item.nonce !== null) details.push({ label: 'nonce', value: item.nonce.toString() });
  if (item.at !== null) details.push({ label: 'submitted', value: utcClock(item.at) });
  if (checked != null) details.push({ label: 'checked', value: `${relativeAge(checked, now)} ago` });
  if (item.slot !== null) details.push({ label: 'slot', value: item.slot.toString() });
  details.push({ label: 'execution', value: execution });
  if (item.pending?.error && item.status === 'uncertain') details.push({ label: 'last check', value: item.pending.error });
  return (
    <div className="wl-stack wl-gap24">
      <FlowBar title={item.kind} onBack={back} />
      <div className="bc-ctr">
        {item.status === 'final-failed' ? (
          <span className="bc-row justify-center">
            <StatusTag status="finalized" />
            <StatusTag status="failed" />
          </span>
        ) : (
          itemTag(item, now)
        )}
        <h1 className="m-0">
          {item.amount ? (
            <Amount units={item.amount.units} scale={item.amount.scale} sign={item.amount.sign} symbol={item.amount.unit} size="balance" />
          ) : (
            <span className="bc-t2">{item.sub}</span>
          )}
        </h1>
      </div>
      <Facts variant="rows" items={key} />
      <Disclosure summary="details">
        <Facts variant="rows" items={details} />
      </Disclosure>
      <Actions align="end">
        <ButtonLink variant="quiet" href={explorerTx(item.id)} external>
          explorer ↗
        </ButtonLink>
        {item.status === 'failed' && (
          <Button variant="ghost" onClick={() => (actions.dismiss(item.id), back())}>
            dismiss
          </Button>
        )}
        {open && (
          <Button variant="ghost" onClick={() => actions.recheck(item.id)}>
            check status
          </Button>
        )}
      </Actions>
    </div>
  );
}
