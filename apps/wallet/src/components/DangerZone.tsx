'use client';

import { useState } from 'react';
import { Button, Card, Row } from '@/components/ui';

export default function DangerZone({ onWalletRemoved }: { onWalletRemoved: () => void }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <Card
      title="Danger zone"
      sub="Removing the wallet erases the encrypted keys from this device. Funds are only recoverable with the 24-word phrase."
    >
      {confirmRemove ? (
        <Row>
          <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
            Keep wallet
          </Button>
          <Button
            variant="danger"
            onClick={onWalletRemoved}
          >
            Erase from this device
          </Button>
        </Row>
      ) : (
        <Button variant="danger" small onClick={() => setConfirmRemove(true)}>
          Remove wallet…
        </Button>
      )}
    </Card>
  );
}
