'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Native modal <dialog>: Escape calls onClose, focus returns to the opener. The element marked
 * `data-autofocus` (e.g. [cancel]) gets focus on open.
 */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!open || !d) return;
    const opener = document.activeElement;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (d.open) d.close();
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="bc-dlg"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="bc-dlg-b">
          <h2 className="bc-t2" id={titleId}>
            {title}
          </h2>
          {description && (
            <p className="bc-small" id={descId}>
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
