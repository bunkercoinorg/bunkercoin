import { useEffect, useState } from 'react';
import { fetchVerifiedMetadata, METADATA_ENABLED, type MetadataDocument } from '@/lib/metadata';

/** The token's metadata document, only once its bytes hash to the on-chain commitment; null otherwise. */
export function useVerifiedMetadata(hash: string | null | undefined): MetadataDocument | null {
  const [doc, setDoc] = useState<{ hash: string; doc: MetadataDocument } | null>(null);
  useEffect(() => {
    if (!hash || !METADATA_ENABLED) return;
    const ctrl = new AbortController();
    void fetchVerifiedMetadata(hash, ctrl.signal).then((d) => {
      if (!ctrl.signal.aborted && d) setDoc({ hash, doc: d });
    });
    return () => ctrl.abort();
  }, [hash]);
  return doc && doc.hash === hash ? doc.doc : null;
}
