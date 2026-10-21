'use client';

import { useState } from 'react';
import { copySensitive } from '@/lib/clipboard';
import { Button, Card, Row, Warn, WordGrid } from '@/components/ui';

export default function Reveal({ mnemonic, onNext }: { mnemonic: string; onNext: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card
      title="Your recovery phrase"
      sub="These 24 words are the only way to recover your wallet. Write them down in order and keep them offline."
    >
      <Warn>
        Anyone with these words controls your funds. They are never sent anywhere. You can view
        them again later from the wallet with your password. A copied phrase is cleared from the
        clipboard after 30 seconds.
      </Warn>
      <WordGrid words={mnemonic.split(' ')} />
      <Row>
        <Button
          variant="ghost"
          onClick={async () => {
            await copySensitive(mnemonic);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button onClick={onNext}>I wrote them down</Button>
      </Row>
    </Card>
  );
}
