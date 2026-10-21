'use client';

import { useEffect, useState } from 'react';
import { shortId } from '@bunkercoin/chain-format';
import { Actions, Button, Checkbox, CopyValue, Dialog, Facts, FlowBar, Segmented, SettingsList } from '@bunkercoin/ui';
import { RPC_URL } from '@/lib/connection';
import { AUTO_LOCK_OPTIONS, type AutoLockMinutes } from '@/lib/session';
import RecoveryPhrase from '@/components/RecoveryPhrase';

export interface SettingsProps {
  address: string;
  autoLockMinutes: AutoLockMinutes;
  onAutoLockChange: (minutes: AutoLockMinutes) => void;
  rpcHost: string;
  /** Revokes the signer, awaits session deletion, clears pending, then shows W01. */
  onWalletRemoved: () => void | Promise<void>;
  /** True while a sub-view with its own flow bar is open. */
  onFlowChange?: (flow: boolean) => void;
}

type View = 'list' | 'phrase' | 'auto-lock' | 'network';

const VIEWS: View[] = ['phrase', 'auto-lock', 'network'];

const viewFromHash = (hash: string): View => {
  const sub = hash.replace(/^#settings\/?/, '');
  return hash.startsWith('#settings/') && VIEWS.includes(sub as View) ? (sub as View) : 'list';
};

const go = (view: View) => {
  window.location.hash = view === 'list' ? '#settings' : `#settings/${view}`;
};

/** W22 list, W23 recovery phrase, W24 erase dialog. Sub-views live at #settings/<view>. */
export default function Settings({ address, autoLockMinutes, onAutoLockChange, rpcHost, onWalletRemoved, onFlowChange }: SettingsProps) {
  const [view, setView] = useState<View>('list');
  const [erasing, setErasing] = useState(false);
  const [hasWords, setHasWords] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setView(viewFromHash(window.location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => onFlowChange?.(view !== 'list'), [view, onFlowChange]);
  useEffect(() => () => onFlowChange?.(false), [onFlowChange]);

  const closeErase = () => {
    setErasing(false);
    setHasWords(false);
  };

  const erase = async () => {
    setBusy(true);
    try {
      await onWalletRemoved();
    } finally {
      setBusy(false);
    }
  };

  if (view === 'phrase') return <RecoveryPhrase onBack={() => go('list')} />;

  if (view === 'auto-lock') {
    return (
      <div className="bc-col-app wl-stack wl-gap24">
        <FlowBar title="auto-lock" onBack={() => go('list')} />
        <Segmented
          label="auto-lock after"
          options={AUTO_LOCK_OPTIONS.map((m) => ({ value: String(m), label: `${m} min` }))}
          value={String(autoLockMinutes)}
          onChange={(v) => onAutoLockChange(Number(v) as AutoLockMinutes)}
        />
        <p className="bc-hint mono">Locks after {autoLockMinutes} min without a tap or key.</p>
      </div>
    );
  }

  if (view === 'network') {
    return (
      <div className="bc-col-app wl-stack wl-gap24">
        <FlowBar title="network" onBack={() => go('list')} />
        <Facts columns={1} items={[{ label: 'rpc', value: <CopyValue value={RPC_URL} mode="full" label="rpc url" /> }]} />
      </div>
    );
  }

  return (
    <div className="bc-col-app wl-stack wl-gap16">
      <h1 className="bc-t2">Settings.</h1>
      <SettingsList
        rows={[
          { label: 'recovery phrase', value: 'password', onClick: () => go('phrase') },
          { label: 'auto-lock', value: `${autoLockMinutes} min`, onClick: () => go('auto-lock') },
          { label: 'network', value: rpcHost, onClick: () => go('network') },
          { label: 'erase wallet', danger: true, onClick: () => setErasing(true) },
        ]}
      />
      <p className="bc-hint mono">Keys stay in this browser.</p>
      <Dialog
        open={erasing}
        title="Erase this wallet."
        description={`This erases the keys for ${shortId(address)} from this browser. Coins stay on-chain. Only the 24 words restore access.`}
        onClose={() => !busy && closeErase()}
      >
        <Checkbox id="erase-has-words" label="I have the 24 words." checked={hasWords} onChange={setHasWords} disabled={busy} />
        <Actions align="end">
          <Button variant="ghost" data-autofocus="" disabled={busy} onClick={closeErase}>
            cancel
          </Button>
          <Button variant="danger-solid" busy={busy} disabled={!hasWords} onClick={() => void erase()}>
            {busy ? 'erasing…' : 'erase'}
          </Button>
        </Actions>
      </Dialog>
    </div>
  );
}
