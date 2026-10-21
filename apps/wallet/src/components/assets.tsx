'use client';

import { useState } from 'react';
import { BrandMark, Icon, type IconName } from '@bunkercoin/ui';
import { formatUnits, utcClock } from '@bunkercoin/chain-format';
import { metadataImageUrl } from '@/lib/metadata';
import { useVerifiedMetadata } from '@/hooks/useVerifiedMetadata';
import type { TokenMeta } from '@/lib/connection';

export const NATIVE = 'BUNKER';

export const bunker = (units: bigint) => formatUnits(units, 6);
export const count = (units: bigint) => formatUnits(units, 0);

export { tokenIdentity } from '@/lib/send';

export const registryEntry = (registry: TokenMeta[] | null, tokenId: string) => registry?.find((r) => r.id === tokenId) ?? null;

/** Two-letter ticker mark, or the verified metadata icon when the document checks out. */
export function TokenMark({ ticker, tokenId, metadataHash }: { ticker: string | null; tokenId: string; metadataHash?: string | null }) {
  const doc = useVerifiedMetadata(metadataHash);
  const [broken, setBroken] = useState(false);
  if (doc?.image && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="wl-tm-img" src={metadataImageUrl(doc.image.sha256)} alt="" onError={() => setBroken(true)} />;
  }
  return <>{(ticker ?? tokenId).slice(0, 2)}</>;
}

export const NativeMark = () => <BrandMark size={16} />;
export const KindMark = ({ icon }: { icon: IconName }) => <Icon name={icon} />;

const DAY = 86_400_000;

/** `today`, `yesterday`, `21 oct` (UTC, like every other time in the wallet). */
export function dayLabel(ms: number, now: number): string {
  const day = (t: number) => Math.floor(t / DAY);
  const diff = day(now) - day(ms);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  const d = new Date(ms);
  return `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toLowerCase()}`;
}

export const at = (ms: number) => utcClock(ms);
