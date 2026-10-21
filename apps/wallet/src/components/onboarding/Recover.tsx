'use client';

import { useState } from 'react';
import { isValidMnemonic, normalizeMnemonic } from '@/lib/keys';
import { Button, Card, Divider, ErrorText, Row, Textarea } from '@/components/ui';

export default function Recover({
  onBack,
  onValid,
}: {
  onBack: () => void;
  onValid: (phrase: string) => void;
}) {
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const normalized = normalizeMnemonic(phrase);
    if (normalized.split(' ').length !== 24) {
      setError('A recovery phrase has exactly 24 words.');
      return;
    }
    if (!isValidMnemonic(normalized)) {
      setError('That is not a valid recovery phrase — check for typos.');
      return;
    }
    onValid(normalized);
  };

  return (
    <Card title="Recover a wallet" sub="Enter your 24-word recovery phrase, separated by spaces.">
      <Textarea
        rows={4}
        value={phrase}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setPhrase(e.target.value);
          setError('');
        }}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Divider />
      <Row>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button disabled={!phrase.trim()} onClick={submit}>
          Continue
        </Button>
      </Row>
    </Card>
  );
}
