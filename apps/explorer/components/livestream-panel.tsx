'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestLabStatus, type LabStreamStatus } from '@/lib/explorer-api/lab-stream';
import { HLS_URL, STREAM_IFRAME_HOSTS, WHEP_URL } from '@/lib/config';
import {
  assessHls,
  firstVariantUrl,
  initialHlsWatch,
  isMasterPlaylist,
  isPlaylist,
  liveEdge,
  type HlsView,
} from '@/lib/hls';
import { allowedStreamUrl, withQuery } from '@/lib/stream-url';
import StreamLikeButton from '@/components/stream-like-button';
import R2StreamPlayer from '@/components/r2-stream-player';
import WhepPlayer from '@/components/whep-player';

type StreamStatus = 'loading' | 'live' | 'waiting' | 'error';

const MANIFEST_POLL_MS = 5000;
// No new segment and no playback progress for this long means the encoder stopped.
const STALE_AFTER_MS = 20_000;
const WHEP_RETRY_BASE_MS = 10_000;
const WHEP_RETRY_MAX_MS = 120_000;
const LAB_STATUS_POLL_MS = 15_000;

// WebRTC (WHEP) is the primary path; the HLS mirror is optional. Production
// sets only WHEP, so a WHEP-only config must stand on its own.
export default function LivestreamPanel() {
  if (WHEP_URL || HLS_URL) return <R2Panel whep={WHEP_URL} hls={HLS_URL} />;
  return <CloudflarePanel />;
}

async function fetchLiveEdge(src: string, signal: AbortSignal): Promise<number | 'unknown'> {
  const get = async (url: string) => {
    const res = await fetch(url, { cache: 'no-store', signal });
    if (!res.ok) throw new Error(`playlist ${res.status}`);
    const text = await res.text();
    if (!isPlaylist(text)) throw new Error('not a playlist');
    return text;
  };
  const top = await get(src);
  if (!isMasterPlaylist(top)) return liveEdge(top);
  const variant = firstVariantUrl(top, src);
  return variant ? liveEdge(await get(variant)) : 'unknown';
}

const HLS_MESSAGES: Record<HlsView, string> = {
  live: 'Live from the radio lab',
  starting: 'Loading live view',
  waiting: 'Waiting for live video',
  unavailable: 'Live view is not available yet',
};

function R2Panel({ whep, hls }: { whep?: string; hls?: string }) {
  const [status, setStatus] = useState<StreamStatus>('loading');
  const [message, setMessage] = useState('Loading live view');
  const [mode, setMode] = useState<'webrtc' | 'hls' | 'idle'>(whep ? 'webrtc' : 'hls');
  // `session` keys the WHEP player; `failures` only drives the retry backoff.
  const [session, setSession] = useState(0);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const watch = useRef(initialHlsWatch);
  const [hlsPlayer, setHlsPlayer] = useState({ mounted: false, key: 0 });
  const lastProgress = useRef(0);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  const whepLive = useCallback(() => {
    failures.current = 0;
    setStatus('live');
    setMessage('Live from the radio lab');
  }, []);

  const whepDown = useCallback(() => {
    const delay = Math.min(WHEP_RETRY_BASE_MS * 2 ** failures.current++, WHEP_RETRY_MAX_MS);
    if (hls) {
      setMode('hls');
    } else {
      setMode('idle');
      setStatus('waiting');
      setMessage('Reconnecting to the live view…');
    }
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      setSession((n) => n + 1);
      setMode('webrtc');
    }, delay);
  }, [hls]);

  const showHls = useCallback((view: HlsView) => {
    const { mounted, playerKey } = watch.current;
    setHlsPlayer((p) => (p.mounted === mounted && p.key === playerKey ? p : { mounted, key: playerKey }));
    setStatus(view === 'live' ? 'live' : view === 'starting' ? 'loading' : 'waiting');
    setMessage(HLS_MESSAGES[view]);
  }, []);

  const hlsProgress = useCallback(() => {
    lastProgress.current = Date.now();
    if (watch.current.mounted) showHls('live');
  }, [showHls]);

  const hlsFatal = useCallback(() => {
    watch.current = { ...watch.current, brokenAt: Date.now(), mounted: false };
    showHls('waiting');
  }, [showHls]);

  useEffect(() => {
    if (mode !== 'hls' || !hls) return;
    const src = hls;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      let edge: number | 'unknown' | null = null;
      try {
        edge = await fetchLiveEdge(src, ctrl.signal);
      } catch {
        // a failed probe is judged below as transient
      }
      if (ctrl.signal.aborted) return;
      const probe = edge === null ? ({ ok: false } as const) : ({ ok: true, edge } as const);
      const r = assessHls(watch.current, probe, lastProgress.current, Date.now(), STALE_AFTER_MS);
      watch.current = r.watch;
      showHls(r.view);
      timer = setTimeout(poll, MANIFEST_POLL_MS);
    }

    void poll();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [hls, mode, showHls]);

  return (
    <PanelChrome status={status} message={message}>
      {mode === 'webrtc' && whep && <WhepPlayer key={session} src={whep} onLive={whepLive} onDown={whepDown} />}
      {mode === 'hls' && hlsPlayer.mounted && hls && (
        <R2StreamPlayer key={hlsPlayer.key} src={hls} onProgress={hlsProgress} onFatal={hlsFatal} />
      )}
    </PanelChrome>
  );
}

// The iframe stays on the first allowed URL until the lab reports a new video.
function nextPlayerUrl(current: string | null, next: LabStreamStatus): string | null {
  const url = allowedStreamUrl(next.iframeUrl, STREAM_IFRAME_HOSTS);
  if (!url) return current;
  if (!current) return url;
  if (!next.activeVideoUid || current.includes(next.activeVideoUid)) return current;
  return url;
}

function CloudflarePanel() {
  const [status, setStatus] = useState<StreamStatus>('loading');
  const [message, setMessage] = useState('Loading live view');
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const playerUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function loadStatus() {
      try {
        const next = await requestLabStatus(ctrl.signal);
        if (ctrl.signal.aborted) return;
        const url = nextPlayerUrl(playerUrlRef.current, next);
        if (url !== playerUrlRef.current) {
          playerUrlRef.current = url;
          setPlayerUrl(url);
        }
        if (!next.inputId || !url) {
          setStatus('waiting');
          setMessage('Live view is not available yet');
        } else if (next.live === false) {
          setStatus('waiting');
          setMessage('Waiting for live video');
        } else {
          setStatus('live');
          setMessage('Live from the radio lab');
        }
      } catch (error) {
        if (ctrl.signal.aborted) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Unable to load live view');
      }
      if (!ctrl.signal.aborted) timer = setTimeout(loadStatus, LAB_STATUS_POLL_MS);
    }

    void loadStatus();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  const iframeSrc = playerUrl ? withQuery(playerUrl, { autoplay: 'true', muted: 'true', controls: 'true' }) : null;

  return (
    <PanelChrome status={status} message={message}>
      {status === 'live' && iframeSrc && (
        <iframe
          src={iframeSrc}
          title="Live View"
          className="absolute left-0 top-0 h-full w-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
        />
      )}
    </PanelChrome>
  );
}

function PanelChrome({
  status,
  message,
  children,
}: {
  status: StreamStatus;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-border bg-card/50">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">BunkerCoin Lab</h2>
          <p className="text-xs text-muted-foreground">Live session broadcast</p>
        </div>
        <span className={statusBadgeClassName(status)}>
          {status === 'live' ? 'Live' : status === 'error' ? 'Offline' : 'Idle'}
        </span>
      </div>
      <div className="relative bg-black">
        <div className="relative pt-[56.25%]">{children}</div>
        {status === 'live' && <StreamLikeButton />}
        {status !== 'live' && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 px-6 text-center">
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function statusBadgeClassName(status: StreamStatus) {
  const base = 'rounded-md px-2 py-1 text-xs font-medium';
  if (status === 'live') return `${base} bg-emerald-500/20 text-emerald-400`;
  if (status === 'error') return `${base} bg-red-500/20 text-red-400`;
  return `${base} bg-muted text-muted-foreground`;
}
