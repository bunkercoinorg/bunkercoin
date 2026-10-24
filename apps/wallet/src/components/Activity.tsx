'use client';

import { useState } from 'react';
import {
  Amount,
  Button,
  EmptyState,
  GroupLabel,
  List,
  ListRow,
  Notice,
  Pagination,
  Segmented,
  StatePanel,
  StateLine,
  StatusTag,
  Tag,
} from '@bunkercoin/ui';
import { phaseLabel } from '@/lib/inflight';
import { formatUnits, relativeAge } from '@bunkercoin/chain-format';
import { viewHref } from '@/hooks/useHashView';
import { activityItems, isOpen, tickerMap, type ActivityItem } from '@/components/activity-model';
import { dayLabel, KindMark } from '@/components/assets';
import type { WalletActions, WalletState } from '@/components/Dashboard';
import { ResourceState } from '@/components/ResourceState';

export function itemTag(item: ActivityItem, now: number, withAge = true) {
  // Radio finality takes many minutes: a slow transfer is normal, so it reads as a calm phase, never an alarm.
  if (item.status === 'pending' || item.status === 'unconfirmed') {
    const age = withAge && item.at ? ` · ${relativeAge(item.at, now)}` : '';
    return <Tag state="pending">{(item.pending ? phaseLabel(item.pending) : 'waiting for a block') + age}</Tag>;
  }
  if (item.status === 'uncertain') return <StatusTag status="unknown" />;
  if (item.status === 'failed' || item.status === 'final-failed') return <StatusTag status="failed" />;
  return null;
}

export function ActivityRow({ item, now }: { item: ActivityItem; now: number }) {
  const amount = item.amount && <Amount units={item.amount.units} scale={item.amount.scale} sign={item.amount.sign} />;
  const failed = item.status === 'failed';
  const tag = itemTag(item, now, false);
  return (
    <ListRow
      href={viewHref('tx', item.id)}
      mark={<KindMark icon={item.icon} />}
      title={item.kind}
      sub={item.sub}
      value={failed ? tag : amount}
      tag={failed ? undefined : (tag ?? undefined)}
      valueSub={
        failed ? 'nothing moved' : item.status === 'final-failed' ? 'fee spent' : item.slot !== null ? `slot ${formatUnits(item.slot, 0)}` : undefined
      }
    />
  );
}

export function useActivity(state: WalletState) {
  return activityItems(state.pending, state.history, state.addressHex, tickerMap(state.tokens, state.registry));
}

export default function Activity({ state, actions }: { state: WalletState; actions: WalletActions }) {
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const now = Date.now();
  const all = useActivity(state);
  const items = filter === 'pending' ? all.filter((i) => isOpen(i.status) || i.status === 'failed') : all;
  const groups: [string, ActivityItem[]][] = [];
  for (const item of items) {
    const label = item.at !== null ? dayLabel(item.at, now) : 'on chain';
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(item);
    else groups.push([label, [item]]);
  }
  const { history, fresh } = state;
  const loading = history === null && fresh.history.error === null;
  return (
    <div className="wl-stack wl-gap16">
      <div className="bc-row justify-between">
        <h1 className="bc-t2 m-0">Activity.</h1>
        <Segmented
          label="filter"
          options={[
            { value: 'all', label: 'all' },
            { value: 'pending', label: 'pending' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      {history !== null && <ResourceState fresh={fresh.history} what="history" onRetry={() => void actions.refresh()} />}
      {state.trackingLost && (
        <Notice tone="warn">Tracking could not be saved in this browser; open transactions are not followed after a reload.</Notice>
      )}
      {loading && items.length === 0 ? (
        <StateLine>loading activity…</StateLine>
      ) : history === null && items.length === 0 ? (
        <StatePanel
          state="error"
          title="Activity unavailable."
          message={fresh.history.error}
          actions={
            <Button variant="ghost" onClick={() => void actions.refresh()}>
              retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          action={
            filter === 'all' && (
              <Button variant="ghost" onClick={() => void actions.go(viewHref('home'))}>
                faucet
              </Button>
            )
          }
        >
          {filter === 'pending' ? 'Nothing pending.' : 'No activity yet.'}
        </EmptyState>
      ) : (
        <div>
          {groups.map(([label, list]) => (
            <section key={label} aria-label={label}>
              <GroupLabel>{label}</GroupLabel>
              <List>
                {list.map((i) => (
                  <ActivityRow key={i.id} item={i} now={now} />
                ))}
              </List>
            </section>
          ))}
        </div>
      )}
      {history && (
        <Pagination
          state={state.historyState}
          onMore={actions.loadOlder}
          note={`latest ${history.scanned.toLocaleString('en-US')} network txs scanned`}
        />
      )}
    </div>
  );
}
