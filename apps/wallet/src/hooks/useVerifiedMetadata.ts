import { useEffect, useState } from 'react';
import { fetchVerifiedImage, fetchVerifiedMetadata, METADATA_ENABLED, type MetadataDocument } from '@/lib/metadata';

const FIRST_RETRY_MS = 2_000;
const MAX_RETRY_MS = 60_000;

/** Calls `attempt` until it yields a value, backing off, for as long as the caller stays mounted on `key`. */
function useVerified<T>(key: string | null | undefined, attempt: (key: string, signal: AbortSignal) => Promise<T | null>): T | null {
  const [found, setFound] = useState<{ key: string; value: T } | null>(null);
  useEffect(() => {
    if (!key || !METADATA_ENABLED) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wait = FIRST_RETRY_MS;
    const run = () =>
      void attempt(key, ctrl.signal).then((value) => {
        if (ctrl.signal.aborted) return;
        if (value !== null) return setFound({ key, value });
        timer = setTimeout(run, wait);
        wait = Math.min(wait * 2, MAX_RETRY_MS);
      });
    run();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [key]);
  return found && found.key === key ? found.value : null;
}

/** The token's metadata document, only once its bytes hash to the on-chain commitment; null otherwise. */
export function useVerifiedMetadata(hash: string | null | undefined): MetadataDocument | null {
  return useVerified(hash, fetchVerifiedMetadata);
}

/** An object URL for the icon, only once its bytes hash to `sha256`; revoked on change and unmount. */
export function useVerifiedImage(sha256: string | null | undefined): string | null {
  const blob = useVerified(sha256, fetchVerifiedImage);
  const [url, setUrl] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const next = { blob, url: URL.createObjectURL(blob) };
    setUrl(next);
    return () => URL.revokeObjectURL(next.url);
  }, [blob]);
  return url && url.blob === blob ? url.url : null;
}
