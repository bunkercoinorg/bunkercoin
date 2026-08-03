'use client';

import { useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { shortAddress } from '@/lib/format';

const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.bunkercoin.com';

interface TxDetailsProps {
  rows: ([string, string] | null)[];
  explorerHash?: string;
}

export default function TxDetails({ rows, explorerHash }: TxDetailsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Long values (hashes, addresses) get a copy affordance; short ones don't need it.
  return (
    <div className="tx-details">
      {rows
        .filter((r): r is [string, string] => r !== null)
        .map(([label, value]) => (
          <div className="tx-detail-row" key={label}>
            <span className="tx-detail-label">{label}</span>
            <span
              className={value.length > 20 ? 'mono clickable' : 'mono'}
              title={value.length > 20 ? 'Click to copy' : undefined}
              onClick={
                value.length > 20
                  ? async () => {
                      await copyText(value);
                      setCopiedKey(label);
                      setTimeout(() => setCopiedKey(null), 1200);
                    }
                  : undefined
              }
            >
              {copiedKey === label ? 'Copied' : value.length > 28 ? shortAddress(value, 10) : value}
            </span>
          </div>
        ))}
      {explorerHash && (
        <div className="tx-detail-row">
          <a
            className="tx-link"
            href={`${EXPLORER_URL}/tx?sig=${explorerHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View in explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}
