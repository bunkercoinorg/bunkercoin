import type { HolderPage, TokenHolder } from './types.ts';

// `consumed` is the raw server offset. Pages can overlap when balances shift,
// which shrinks the de-duplicated list but must never rewind the offset.
export interface HolderList {
  holders: TokenHolder[];
  consumed: number;
  total: number;
  done: boolean;
}

export const emptyHolders: HolderList = { holders: [], consumed: 0, total: 0, done: false };

export function appendHolders(list: HolderList, page: HolderPage | null, limit: number): HolderList {
  const rows = page?.holders ?? [];
  const byKey = new Map(list.holders.map((h) => [h.pubkey, h]));
  for (const h of rows) byKey.set(h.pubkey, h);
  const consumed = list.consumed + rows.length;
  const total = page?.total ?? list.total;
  return { holders: [...byKey.values()], consumed, total, done: rows.length < limit || consumed >= total };
}
