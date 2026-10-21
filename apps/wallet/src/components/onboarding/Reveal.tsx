'use client';

import { Button, Card, Row, Warn, WordGrid } from '@/components/ui';

export default function Reveal({ mnemonic, onNext }: { mnemonic: string; onNext: () => void }) {
  return (
    <Card
      title="Your recovery phrase"
      sub="These 24 words are the only way to recover your wallet. Write them down in order and keep them offline."
    >
      <Warn>
        Anyone with these words controls your funds. They are never sent anywhere. You can view
        them again later from the wallet with your password. Write them on paper; the wallet does
        not offer to copy them.
      </Warn>
      <WordGrid words={mnemonic.split(' ')} />
      <Row>
        <Button onClick={onNext}>I wrote them down</Button>
      </Row>
    </Card>
  );
}
