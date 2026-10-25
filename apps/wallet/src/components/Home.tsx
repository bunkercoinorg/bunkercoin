'use client';

import { useState } from 'react';
import {
  ActionTile,
  ActionTiles,
  Amount,
  BalanceHero,
  EmptyState,
  List,
  ListRow,
  Notice,
  Link,
  SectionHead,
  StateLine,
  StatusTag,
} from '@bunkercoin/ui';
import { relativeAge, utcClock } from '@bunkercoin/chain-format';
import type { TokenBalance } from '@/lib/connection';
import { viewHref } from '@/hooks/useHashView';
import { useVerifiedMetadata } from '@/hooks/useVerifiedMetadata';
import { ActivityRow, useActivity } from '@/components/Activity';
import { isOpen } from '@/components/activity-model';
import { tokenPendingOut } from '@/lib/inflight';
import { bunker, count, NATIVE, NativeMark, TokenMark } from '@/components/assets';
import { ResourceState, STALE_MS } from '@/components/ResourceState';
import type { WalletActions, WalletState } from '@/components/Dashboard';

function TokenRow({ token, out }: { token: TokenBalance; out: bigint }) {
  const doc = useVerifiedMetadata(token.metadataHash);
  const title = token.ticker ?? `token ${token.tokenId}`;
  const held = count(token.balance > out ? token.balance - out : 0n);
  return (
    <ListRow
      href={viewHref('tokens', token.tokenId)}
      mark={<TokenMark ticker={token.ticker} tokenId={token.tokenId} metadataHash={token.metadataHash} />}
      title={title}
      sub={doc ? `${doc.name} · ${token.tokenId}` : token.ticker ? token.tokenId : 'no ticker'}
      value={held}
      valueLabel={`${title} balance ${held} available`}
      valueSub={out > 0n ? `${count(out)} pending out` : undefined}
    />
  );
}

export default function Home({ state, actions }: { state: WalletState; actions: WalletActions }) {
  const { balance, tokens, fresh, offline, spendable } = state;
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetError, setFaucetError] = useState('');
  const items = useActivity(state);
  const now = Date.now();
  const tokenOut = tokenPendingOut(state.pending);
  const inflight = items.filter((i) => isOpen(i.status));
  const settled = items.filter((i) => !isOpen(i.status));
  const okAt = fresh.balance.okAt;
  const stale = okAt !== null && (fresh.balance.error !== null || now - okAt > STALE_MS);
  const zero = spendable.available === 0n;
  const available = spendable.available === null ? null : bunker(spendable.available);

  const requestFaucet = async () => {
    setFaucetBusy(true);
    setFaucetError('');
    try {
      await actions.faucet();
    } catch (e) {
      setFaucetError((e as Error).message);
    } finally {
      setFaucetBusy(false);
    }
  };

  return (
    <div className="wl-stack wl-gap40">
      <h1 className="bc-sr">Home.</h1>
      <BalanceHero>
        {balance === null && okAt === null && fresh.balance.error === null ? (
          <StateLine>checking balance…</StateLine>
        ) : (
          <Amount
            units={spendable.available}
            scale={6}
            symbol={NATIVE}
            size="balance"
            label={available === null ? 'Balance unknown' : `Balance ${available} ${NATIVE} available`}
          />
        )}
        {(spendable.pendingOut > 0n || spendable.pendingIn > 0n) && (
          <p className="wl-split bc-hint mono" data-testid="pending-split">
            <span>{available ?? '–'} BUNKER available</span>
            {spendable.pendingOut > 0n && <span>· {bunker(spendable.pendingOut)} pending out</span>}
            {spendable.pendingIn > 0n && <span className="wl-in">· +{bunker(spendable.pendingIn)} pending in, not spendable yet</span>}
          </p>
        )}
        {stale && okAt !== null && (
          <p className="wl-hero-sub bc-hint mono">
            as of {utcClock(okAt)} <StatusTag status="stale" detail={relativeAge(okAt, now)} />
          </p>
        )}
      </BalanceHero>
      <div className="wl-stack wl-gap12">
        <ActionTiles>
          <ActionTile icon="send" label="send" href={viewHref('send')} disabled={offline || zero} />
          <ActionTile icon="receive" label="receive" href={viewHref('receive')} />
          <ActionTile
            icon="faucet"
            label="faucet"
            primary={zero && !offline}
            disabled={offline || faucetBusy}
            onClick={() => void requestFaucet()}
          />
          <ActionTile icon="plus" label="token" href={viewHref('token')} disabled={offline} />
        </ActionTiles>
        {faucetError && (
          <Notice tone="error" role="alert">
            {faucetError}
          </Notice>
        )}
      </div>
      {inflight.length > 0 && (
        <section aria-labelledby="home-inflight">
          <SectionHead label="in flight" id="home-inflight" action={state.cadence && <span className="bc-hint mono">{state.cadence}</span>} />
          <List>
            {inflight.map((i) => (
              <ActivityRow key={i.id} item={i} now={now} />
            ))}
          </List>
        </section>
      )}
      <section aria-labelledby="home-tokens">
        <SectionHead
          label="tokens"
          id="home-tokens"
          action={<ResourceState fresh={fresh.tokens} what="token balances" onRetry={() => void actions.refresh()} />}
        />
        <List>
          <ListRow
            mark={<NativeMark />}
            title={NATIVE}
            sub="native"
            value={available ?? '–'}
            valueLabel={`${NATIVE} balance ${available ?? 'unknown'}${available === null ? '' : ' available'}`}
            valueSub={spendable.pendingOut > 0n ? `${bunker(spendable.pendingOut)} pending out` : undefined}
          />
          {tokens.map((t) => (
            <TokenRow key={t.tokenId} token={t} out={tokenOut.get(t.tokenId) ?? 0n} />
          ))}
        </List>
      </section>
      <section aria-labelledby="home-activity">
        <SectionHead
          label="activity"
          id="home-activity"
          action={
            offline ? (
              <span className="bc-hint mono">checking paused</span>
            ) : (
              <span className="bc-row">
                <ResourceState fresh={fresh.history} what="history" onRetry={() => void actions.refresh()} />
                <Link className="bc-mini" href={viewHref('activity')}>
                  all →
                </Link>
              </span>
            )
          }
        />
        {settled.length === 0 ? (
          <EmptyState>{state.history === null ? 'loading activity…' : inflight.length > 0 ? 'Nothing settled yet.' : 'No activity yet.'}</EmptyState>
        ) : (
          <List>
            {settled.slice(0, 3).map((i) => (
              <ActivityRow key={i.id} item={i} now={now} />
            ))}
          </List>
        )}
      </section>
    </div>
  );
}
