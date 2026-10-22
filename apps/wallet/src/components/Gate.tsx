'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button, ButtonLink, Disclosure, Facts, Tag, type TagState } from '@bunkercoin/ui';
import { describeRecord, KEYSTORE_KEY, readKeystoreRaw } from '@/lib/keystore';

export type GateKind = 'checking' | 'unreadable' | 'insecure' | 'storage' | 'nocrypto';

export interface GateProps {
  kind: GateKind;
  /** The underlying reason (storage error, parse failure), shown behind `details`. */
  detail?: string;
  /** unreadable: import with 24 words while the record stays until replacement is confirmed. */
  onImport?: () => void;
}

const HTTPS_URL = 'https://wallet.bunkercoin.com';

const COPY: Record<Exclude<GateKind, 'checking'>, { tag: string; state: TagState; title: string; line: string }> = {
  unreadable: { tag: 'unreadable', state: 'failed', title: 'Saved wallet unreadable.', line: 'Damaged record or unknown version. Saved data is unchanged.' },
  insecure: { tag: 'insecure', state: 'failed', title: 'Open the wallet over https.', line: 'Plain http turns off encryption here.' },
  storage: { tag: 'blocked', state: 'failed', title: 'This browser blocks storage.', line: 'Allow site data for wallet.bunkercoin.com, or use another browser.' },
  nocrypto: { tag: 'unsupported', state: 'failed', title: "This browser can't encrypt.", line: 'Use a current Chrome, Firefox or Safari.' },
};

function downloadRecord(raw: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${KEYSTORE_KEY}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** W02: startup check and the problem states, one layout. */
export function Gate({ kind, detail, onImport }: GateProps) {
  const [raw, setRaw] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
    if (kind !== 'unreadable') return;
    try {
      setRaw(readKeystoreRaw());
    } catch {
      setRaw(null);
    }
  }, [kind]);

  if (kind === 'checking') {
    return (
      <div className="mx-auto w-full max-w-[480px] pt-6 text-center" role="status">
        <p className="bc-hint mono">checking this browser…</p>
      </div>
    );
  }

  const copy = COPY[kind];
  let details: ReactNode = detail;
  let action: ReactNode = (
    <Button block onClick={() => window.location.reload()}>
      retry
    </Button>
  );
  if (kind === 'unreadable') {
    details = (
      <Facts
        columns={1}
        items={[
          {
            label: 'record',
            value: (
              <>
                {KEYSTORE_KEY} <span className="bc-small">· {raw === null ? (detail ?? 'unknown') : describeRecord(raw)}</span>
              </>
            ),
          },
        ]}
      />
    );
    action = (
      <div className="wl-stack wl-gap12">
        <Button block onClick={onImport}>
          import with 24 words
        </Button>
        {raw !== null && (
          <div className="text-center">
            <Button variant="quiet" onClick={() => downloadRecord(raw)}>
              download record
            </Button>
          </div>
        )}
      </div>
    );
  } else if (kind === 'insecure') {
    details = origin ? `origin ${origin}` : detail;
    action = (
      <ButtonLink href={HTTPS_URL} external block>
        open {HTTPS_URL}
      </ButtonLink>
    );
  } else if (kind === 'nocrypto') {
    details = detail ?? 'crypto.subtle is missing';
  }

  return (
    <div className="mx-auto w-full max-w-[480px] wl-stack wl-gap24">
      <div>
        <Tag state={copy.state}>{copy.tag}</Tag>
        <h1 className="bc-t1">{copy.title}</h1>
        <p className="bc-lead">{copy.line}</p>
      </div>
      {details && <Disclosure summary="details">{details}</Disclosure>}
      {action}
    </div>
  );
}

export default Gate;
