'use client';

import { useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { Button, Card, Row, Warn, WordGrid } from '@/components/ui';

export default function Reveal({ mnemonic, onNext }: { mnemonic: string; onNext: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card
      title="Your recovery phrase"
      sub="These 24 words are the only way to recover your wallet. Write them down in order and keep them offline."
    >
      <Warn>
        Anyone with these words controls your funds. They are never sent anywhere and cannot be
        shown again after setup.
      </Warn>
      <WordGrid words={mnemonic.split(' ')} />
      <Row>
        <Button
          variant="ghost"
          onClick={async () => {
            await copyText(mnemonic);
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
