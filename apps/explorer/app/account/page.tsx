'use client';

import { formatInteger, toBase58 } from '@bunkercoin/chain-format';
import { Amount, CopyValue, Disclosure, Notice, Panel } from '@bunkercoin/ui';
import { DataTable } from '@bunkercoin/ui/explorer';
import { DetailGate, RefreshState } from '@/components/detail';
import { useQueryParam } from '@/lib/use-query-param';
import { useEntity, type EntityState } from '@/lib/use-entity';
import { api } from '@/lib/api';
import { routes } from '@/lib/routes';
import { accountHasActivity } from '@/lib/search';
import { tokenLabel } from '@/lib/token-label';
import type { AccountDetails } from '@/lib/types';

type Held = { id: string; balance: bigint };

function AccountView({ account, entity }: { account: AccountDetails; entity: EntityState<AccountDetails> }) {
  const registry = useEntity('tokens', (_, signal) => api.getTokens({ signal }));
  const byId = new Map((registry.data ?? []).map((t) => [t.id, t]));
  const held: Held[] = Object.entries(account.token_balances).map(([id, balance]) => ({ id, balance }));
  const active = accountHasActivity(account);
  return (
    <>
      <h1 className="bc-t1 m-0">Account.</h1>
      <CopyValue value={toBase58(account.pubkey)} mode="full" label="address" />
      {active ? (
        <>
          <div className="flex flex-col gap-2">
            <Amount units={account.native_balance} scale={6} symbol="BUNKER" size="balance" />
            <p className="bc-hint mono m-0">
              nonce {account.nonce.toString()} · <RefreshState entity={entity} />
            </p>
          </div>
          <Panel title="tokens" meta={String(held.length)} flush>
            <DataTable
              caption="token balances"
              columns={[
                { key: 'ticker', header: 'ticker', cell: (h) => tokenLabel(h.id, byId.get(h.id)) },
                { key: 'id', header: 'token id', cell: (h) => <span className="mono">{h.id}</span> },
                { key: 'held', header: 'held', align: 'right', cell: (h) => <span className="mono">{formatInteger(h.balance)}</span> },
              ]}
              rows={held}
              rowKey={(h) => h.id}
              rowHref={(h) => routes.token(h.id)}
              phone={(h) => (
                <>
                  <span className="block">{tokenLabel(h.id, byId.get(h.id))}</span>
                  <span className="bc-hint mono block">
                    {h.id} · {formatInteger(h.balance)}
                  </span>
                </>
              )}
              empty="No token balances."
            />
          </Panel>
        </>
      ) : (
        <Notice tone="info">No activity recorded for this address yet. Balances are zero until it receives funds.</Notice>
      )}
      <Disclosure summary="hex">
        <CopyValue value={account.pubkey} mode="full" label="address hex" />
      </Disclosure>
    </>
  );
}

export default function AccountPage() {
  const address = useQueryParam('address');
  const entity = useEntity(address, (id, signal) => api.getAccount(id, { signal }));
  return (
    <DetailGate
      entity={entity}
      id={address}
      what="account"
      back={null}
      missing="Search for an address."
      unavailable="Account unavailable."
      notFound={{ title: 'Not an address.', message: 'Enter a 32-byte address in base58 or hex.' }}
    >
      {(account) => <AccountView account={account} entity={entity} />}
    </DetailGate>
  );
}
