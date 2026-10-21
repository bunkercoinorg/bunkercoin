import { normalizeHash, normalizeSlot, normalizeTokenId, toBase58 } from './codec.ts';
import type { AccountDetails, SearchKind, SearchMatch } from './types.ts';

export interface SearchCandidate {
  kind: SearchKind;
  id: string;
}

// Every entity a query could name by shape alone. An 8-digit string is both a
// slot and a token id, and a 32-byte value is a tx, block, or account.
export function classifyQuery(raw: string): SearchCandidate[] {
  const q = raw.trim();
  if (!q) return [];
  const out: SearchCandidate[] = [];
  const slot = normalizeSlot(q);
  if (slot !== null) out.push({ kind: 'block', id: slot });
  const token = normalizeTokenId(q);
  if (token !== null) out.push({ kind: 'token', id: token });
  if (/^skip-\d+$/.test(q)) out.push({ kind: 'block', id: q });
  const hash = normalizeHash(q);
  if (hash !== null) {
    out.push({ kind: 'transaction', id: hash }, { kind: 'block', id: hash }, { kind: 'account', id: hash });
  }
  return out;
}

export interface SearchProbes {
  transaction: (hex: string) => Promise<unknown | null>;
  block: (id: string) => Promise<unknown | null>;
  blockBySlot: (slot: string) => Promise<unknown | null>;
  token: (id: string) => Promise<unknown | null>;
  account: (hex: string) => Promise<AccountDetails | null>;
}

// The node answers any well-formed pubkey with a zeroed account, so only
// on-chain activity counts as existence.
export const accountHasActivity = (a: AccountDetails) =>
  a.nonce > 0n || a.native_balance > 0n || Object.values(a.token_balances).some((b) => b > 0n);

function label(c: SearchCandidate): string {
  switch (c.kind) {
    case 'block':
      return /^\d+$/.test(c.id) ? `Block #${c.id}` : `Block ${c.id}`;
    case 'token':
      return `Token ${c.id}`;
    case 'transaction':
      return `Transaction ${toBase58(c.id)}`;
    case 'account':
      return `Account ${toBase58(c.id)}`;
  }
}

// Probes every candidate; a probe that errors (not 404) fails the search so an
// outage is never reported as "nothing found".
export async function resolveSearch(raw: string, probes: SearchProbes): Promise<SearchMatch[]> {
  const candidates = classifyQuery(raw);
  const hits = await Promise.all(
    candidates.map(async (c) => {
      switch (c.kind) {
        case 'block':
          return /^\d+$/.test(c.id) ? (await probes.blockBySlot(c.id)) !== null : (await probes.block(c.id)) !== null;
        case 'token':
          return (await probes.token(c.id)) !== null;
        case 'transaction':
          return (await probes.transaction(c.id)) !== null;
        case 'account': {
          const a = await probes.account(c.id);
          return a !== null && accountHasActivity(a);
        }
      }
    }),
  );
  return candidates.filter((_, i) => hits[i]).map((c) => ({ ...c, label: label(c) }));
}
