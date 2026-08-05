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
    <div className="mt-1 mb-3 divide-y divide-line rounded-lg border border-line bg-panel-2 px-3.5 py-1.5">
      {rows
        .filter((r): r is [string, string] => r !== null)
        .map(([label, value]) => (
          <div className="flex justify-between gap-4 py-[7px] text-[12.5px]" key={label}>
            <span className="flex-none pt-0.5 font-mono text-[10.5px] tracking-[0.12em] uppercase text-faint">
              {label}
            </span>
            <span
              className={value.length > 20 ? 'cursor-pointer font-mono' : 'font-mono'}
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
        <div className="flex justify-between gap-4 py-[7px] text-[12.5px]">
          <a
            className="text-[12.5px] font-medium text-accent hover:underline hover:underline-offset-3"
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
