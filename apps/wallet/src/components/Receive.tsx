'use client';

import { CopyValue, FlowBar, QrCode } from '@bunkercoin/ui';

export default function Receive({ address, onBack }: { address: string; onBack: () => void }) {
  return (
    <div className="wl-stack wl-gap24 mx-auto max-w-110">
      <FlowBar title="receive" onBack={onBack} />
      <h1 className="bc-sr">Receive.</h1>
      <div className="grid justify-items-center">
        <QrCode value={address} label="QR code of this wallet's address" />
      </div>
      <CopyValue value={address} mode="box" label="address" />
      <p className="bc-hint text-center">BunkerCoin testnet only. Coins sent from other networks are lost.</p>
    </div>
  );
}
