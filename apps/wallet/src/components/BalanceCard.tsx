'use client';

import { useState } from 'react';
import type { TokenBalance } from '@/lib/connection';
import { formatUnits, shortAddress } from '@/lib/format';
import { copyText } from '@/lib/clipboard';

interface BalanceCardProps {
  address: string;
  balance: number | null;
  tokens: TokenBalance[];
}

export default function BalanceCard({ address, balance, tokens }: BalanceCardProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <div className="balance">
        <span className="amount">{balance === null ? '—' : formatUnits(balance)}</span>
        <span className="unit">BUNKER</span>
      </div>
      <div className="address-line">
        <span title={address}>{shortAddress(address, 8)}</span>
        <button
          className="btn-ghost btn-small"
          onClick={async () => {
            await copyText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {tokens.length > 0 && (
        <>
          <hr className="divider" />
          {tokens.map((t, i) => (
            <div className="token-row" key={i}>
              <span>{t.ticker || `Token ${t.tokenId ?? t.token_id ?? i}`}</span>
              {/* Custom tokens have no decimals on-chain — raw count, not µ units. */}
              <span className="mono">{(t.amount ?? t.balance ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
