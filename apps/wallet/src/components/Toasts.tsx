'use client';

import { useEffect } from 'react';
import { Button, StatusTag } from '@bunkercoin/ui';
import type { Note } from '@/hooks/useInflight';

const SHOW_MS = 12_000;

/** In-page completion notices for tracked transfers; each fades out on its own and can be dismissed. */
export default function Toasts({ notes, onDismiss }: { notes: Note[]; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timers = notes.map((n) => setTimeout(() => onDismiss(n.id), SHOW_MS));
    return () => timers.forEach(clearTimeout);
  }, [notes, onDismiss]);
  return (
    <div className="wl-toasts" role="status" aria-live="polite">
      {notes.map((n) => (
        <div key={n.id} className="wl-toast" data-tone={n.tone}>
          <StatusTag status={n.tone === 'ok' ? 'finalized' : 'failed'} />
          <span className="bc-grow">{n.text}</span>
          <Button variant="quiet" size="sm" aria-label="dismiss" onClick={() => onDismiss(n.id)}>
            ×
          </Button>
        </div>
      ))}
    </div>
  );
}
