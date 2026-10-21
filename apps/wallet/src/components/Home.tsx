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
import { formatUnits, relativeAge, utcClock } from '@bunkercoin/chain-format';
import type { TokenBalance } from '@/lib/connection';
import { viewHref } from '@/hooks/useHashView';
import { useVerifiedMetadata } from '@/hooks/useVerifiedMetadata';
import { ActivityRow, useActivity } from '@/components/Activity';
import { bunker, count, NATIVE, NativeMark, TokenMark } from '@/components/assets';
import { ResourceState, STALE_MS } from '@/components/ResourceState';
import type { WalletActions, WalletState } from '@/components/Dashboard';

function TokenRow({ token }: { token: TokenBalance }) {
  const doc = useVerifiedMetadata(token.metadataHash);
  return (
    <ListRow
      href={viewHref('tokens', token.tokenId)}
      mark={<TokenMark ticker={token.ticker} tokenId={token.tokenId} metadataHash={token.metadataHash} />}
      title={token.ticker ?? `token ${token.tokenId}`}
      sub={doc ? `${doc.name} · ${token.tokenId}` : token.ticker ? token.tokenId : 'no ticker'}
      value={count(token.balance)}
    />
  );
}

export default function Home({ state, actions }: { state: WalletState; actions: WalletActions }) {
  const { balance, tokens, fresh, offline } = state;
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetError, setFaucetError] = useState('');
  const items = useActivity(state);
  const now = Date.now();
  const outgoing = state.pending
    .filter((p) => (p.kind === 'send' || p.kind === 'token-send' || p.kind === 'mint') && p.state !== 'failed')
    .reduce((sum, p) => sum + (p.kind === 'send' ? p.amount : 0n) + (p.fee ?? 0n), 0n);
  const okAt = fresh.balance.okAt;
  const stale = okAt !== null && (fresh.balance.error !== null || now - okAt > STALE_MS);
  const zero = balance === 0n;

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
          <Amount units={balance} scale={6} symbol={NATIVE} size="balance" />
        )}
        {outgoing > 0n && <p className="bc-hint mono">−{formatUnits(outgoing, 6)} pending</p>}
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
      <section aria-labelledby="home-tokens">
        <SectionHead
          label="tokens"
          id="home-tokens"
          action={<ResourceState fresh={fresh.tokens} what="token balances" onRetry={() => void actions.refresh()} />}
        />
        <List>
          <ListRow mark={<NativeMark />} title={NATIVE} sub="native" value={balance === null ? '–' : bunker(balance)} />
          {tokens.map((t) => (
            <TokenRow key={t.tokenId} token={t} />
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
        {items.length === 0 ? (
          <EmptyState>{state.history === null ? 'loading activity…' : 'No activity yet.'}</EmptyState>
        ) : (
          <List>
            {items.slice(0, 3).map((i) => (
              <ActivityRow key={i.id} item={i} now={now} />
            ))}
          </List>
        )}
      </section>
    </div>
  );
}
