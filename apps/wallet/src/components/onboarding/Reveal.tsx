'use client';

import { useCallback, useState } from 'react';
import { Button, FlowBar, Panel, WordGrid, WordGridHidden } from '@bunkercoin/ui';
import { hidesIn, useAutoHide } from '@/components/onboarding/useAutoHide';

/** W03: the words mount only after the reveal tap and unmount on hide, 60s idle or a hidden tab. No copy. */
export default function Reveal({ mnemonic, onBack, onNext }: { mnemonic: string; onBack: () => void; onNext: () => void }) {
  const [shown, setShown] = useState(false);
  const [seen, setSeen] = useState(false);
  const hide = useCallback(() => setShown(false), []);
  const left = useAutoHide(shown, hide);
  return (
    <div className="bc-col-app wl-stack wl-gap24">
      <FlowBar title="create wallet" step={[1, 4]} onBack={onBack} />
      <div>
        <h1 className="bc-t1">Write down your 24 words.</h1>
        <p className="bc-lead">In order, on paper. Anyone with them controls the coins.</p>
      </div>
      {shown ? (
        <Panel
          title="recovery phrase"
          meta={hidesIn(left)}
          actions={
            <Button variant="ghost" size="sm" onClick={hide}>
              hide
            </Button>
          }
          flush
        >
          <WordGrid words={mnemonic.split(' ')} />
        </Panel>
      ) : (
        <WordGridHidden>
          <span className="bc-small">24 words · hidden</span>
          <Button
            variant="ghost"
            onClick={() => {
              setShown(true);
              setSeen(true);
            }}
          >
            show words
          </Button>
        </WordGridHidden>
      )}
      <Button block disabled={!seen} onClick={onNext}>
        i wrote them down
      </Button>
    </div>
  );
}
