'use client';

import { useState } from 'react';
import { clearKeystore } from '@/lib/keystore';

export default function DangerZone({ onWalletRemoved }: { onWalletRemoved: () => void }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <div className="card">
      <h2>Danger zone</h2>
      <p className="sub">
        Removing the wallet erases the encrypted keys from this device. Funds are only recoverable
        with the 24-word phrase.
      </p>
      {confirmRemove ? (
        <div className="row">
          <button className="btn-ghost" onClick={() => setConfirmRemove(false)}>
            Keep wallet
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              clearKeystore();
              onWalletRemoved();
            }}
          >
            Erase from this device
          </button>
        </div>
      ) : (
        <button className="btn-danger btn-small" onClick={() => setConfirmRemove(true)}>
          Remove wallet…
        </button>
      )}
    </div>
  );
}
