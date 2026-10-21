'use client';

import { useState } from 'react';
import { tokenLabel, type TokenBalance } from '@/lib/connection';
import { formatCount, formatUnits, shortAddress } from '@/lib/format';
import { copyText } from '@/lib/clipboard';
import { Button, Card, Divider } from '@/components/ui';

interface BalanceCardProps {
  address: string;
  balance: bigint | null;
  tokens: TokenBalance[];
}

export default function BalanceCard({ address, balance, tokens }: BalanceCardProps) {
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <div className="pt-3.5 pb-1.5 text-center">
        <span className="text-[46px] font-semibold tracking-[-0.02em] tabular-nums">
          {balance === null ? '—' : formatUnits(balance)}
        </span>
        <span className="ml-2 font-mono text-[13px] tracking-[0.12em] text-muted">BUNKER</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[12.5px] text-muted">
        <span title={address}>{shortAddress(address, 8)}</span>
        <Button
          variant="ghost"
          small
          onClick={async () => {
            await copyText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {tokens.length > 0 && (
        <>
          <Divider />
          {tokens.map((t) => (
            <div className="flex items-center justify-between border-t border-line py-3 text-sm" key={t.tokenId}>
              <span>{tokenLabel(t)}</span>
              {/* Custom tokens have no decimals on-chain — raw count, not µ units. */}
              <span className="font-mono">{formatCount(t.balance)}</span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}
