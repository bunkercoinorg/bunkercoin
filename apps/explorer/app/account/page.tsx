'use client';

import Header from '@/components/header';
import { EntityPage, DetailRow, HashLink, NotFoundCard, ErrorCard, Loading } from '@/components/explorer-ui';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity } from '@/lib/use-entity';
import { api } from '@/lib/api';
import { toBase58 } from '@/lib/codec';
import { formatBunker, formatInteger } from '@/lib/amount';
import { routes } from '@/lib/routes';

export default function AccountPage() {
  const address = useQueryParam('address');
  const { status, data: account, error, retry } = useEntity(address, (id, signal) => api.getAccount(id, { signal }));

  const tokens = account ? Object.entries(account.token_balances) : [];

  return (
    <>
      <Header />
      <EntityPage title="Account">
        {status === 'loading' ? (
          <Loading />
        ) : status === 'error' ? (
          <ErrorCard message={error ?? 'Could not load the account.'} onRetry={retry} />
        ) : !account ? (
          <NotFoundCard what="account" id={address ?? ''} />
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border border-border/60 bg-card px-5">
              <DetailRow label="Address">
                <HashLink value={toBase58(account.pubkey)} truncateTo={false} />
              </DetailRow>
              <DetailRow label="Balance">
                <span className="text-lg font-semibold">{formatBunker(account.native_balance)}</span>{' '}
                <span className="text-muted-foreground text-sm">BUNKER</span>
              </DetailRow>
              <DetailRow label="Nonce">{account.nonce.toString()}</DetailRow>
            </div>

            {tokens.length > 0 ? (
              <div className="rounded-lg border border-border/60 bg-card p-5">
                <h3 className="text-sm font-medium mb-3">Token balances</h3>
                <div className="space-y-2">
                  {tokens.map(([id, bal]) => (
                    <div key={id} className="flex items-center justify-between text-sm">
                      <HashLink value={id} href={routes.token(id)} truncateTo={false} />
                      <span className="font-mono">{formatInteger(bal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </EntityPage>
    </>
  );
}
