import { formatInteger, formatUnits, normalizeHash, normalizeSlot, normalizeTokenId, toBase58 } from '@bunkercoin/chain-format';
import { coarseAge } from './cadence.ts';
import type { AccountDetails, Block, SearchKind, SearchMatch, TokenSummary, TransactionDetails } from './types.ts';

export interface SearchCandidate {
  kind: SearchKind;
  id: string;
}

const PREFIXES: Record<string, SearchKind> = { slot: 'block', block: 'block', tx: 'transaction', account: 'account', token: 'token' };

// Every entity a query could name by shape alone. An 8-digit string is both a
// slot and a token id, and a 32-byte value is a tx, block, or account. A
// `slot:`/`block:`/`tx:`/`account:`/`token:` prefix keeps only that kind.
export function classifyQuery(raw: string): SearchCandidate[] {
  const prefixed = /^(slot|block|tx|account|token):\s*(.*)$/i.exec(raw.trim());
  if (prefixed) {
    const name = prefixed[1].toLowerCase();
    return classifyShape(prefixed[2]).filter((c) => c.kind === PREFIXES[name] && (name !== 'slot' || /^\d+$/.test(c.id)));
  }
  return classifyShape(raw);
}

function classifyShape(raw: string): SearchCandidate[] {
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
  transaction: (hex: string) => Promise<TransactionDetails | null>;
  block: (id: string) => Promise<Block | null>;
  blockBySlot: (slot: string) => Promise<Block | null>;
  token: (id: string) => Promise<TokenSummary | null>;
  account: (hex: string) => Promise<AccountDetails | null>;
}

// The node answers any well-formed pubkey with a zeroed account, so a zeroed
// account is a valid but unconfirmed candidate.
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
    candidates.map(async (c): Promise<SearchMatch | null> => {
      const match = { ...c, label: label(c) };
      switch (c.kind) {
        case 'block': {
          const b = /^\d+$/.test(c.id) ? await probes.blockBySlot(c.id) : await probes.block(c.id);
          return b === null ? null : { ...match, block: b };
        }
        case 'token': {
          const t = await probes.token(c.id);
          return t === null ? null : { ...match, token: t };
        }
        case 'transaction': {
          const t = await probes.transaction(c.id);
          return t === null ? null : { ...match, transaction: t };
        }
        case 'account': {
          const a = await probes.account(c.id);
          if (a === null) return null;
          return accountHasActivity(a) ? { ...match, account: a } : { ...match, account: a, label: `${match.label} (no activity yet)`, inactive: true };
        }
      }
    }),
  );
  return hits.filter((m) => m !== null);
}

// The second line of a result row: ticker · supply for a token, state · age for a block, and so on.
export function matchContext(m: SearchMatch, now: number | null): string {
  if (m.block) {
    const b = m.block;
    const at = b.finalized_timestamp ?? b.proposed_timestamp;
    const state = b.type === 'skip' ? 'skipped' : b.status;
    return at === undefined || now === null ? state : `${state} · ${coarseAge(at, now)} ago`;
  }
  if (m.token) return `${m.token.ticker} · supply ${formatInteger(m.token.current_supply)}`;
  if (m.transaction) {
    const s = m.transaction.status;
    const failed = s.success === false ? ' · failed' : '';
    return s.slot === undefined ? s.location + failed : `${s.location} · slot ${formatInteger(BigInt(s.slot))}${failed}`;
  }
  if (m.account) {
    if (m.inactive) return 'address with no recorded activity';
    const tokens = Object.keys(m.account.token_balances).length;
    return `${formatUnits(m.account.native_balance, 6)} BUNKER${tokens ? ` · ${tokens} ${tokens === 1 ? 'token' : 'tokens'}` : ''}`;
  }
  return '';
}

export type SearchOutcome = { kind: 'route'; match: SearchMatch } | { kind: 'choose'; matches: SearchMatch[] } | { kind: 'none' };

// Only a single confirmed match routes directly; an account with no activity
// is always offered as a choice, never followed on its own.
export function searchOutcome(matches: SearchMatch[]): SearchOutcome {
  const active = matches.filter((m) => !m.inactive);
  if (active.length === 1) return { kind: 'route', match: active[0] };
  if (!matches.length) return { kind: 'none' };
  return { kind: 'choose', matches: [...active, ...matches.filter((m) => m.inactive)] };
}
