'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { Button, Link, Panel, StatusTag, useNow } from '@bunkercoin/ui';
import StreamLikeButton from '@/components/stream-like-button';
import R2StreamPlayer from '@/components/r2-stream-player';
import WhepPlayer from '@/components/whep-player';

type StreamStatus = 'loading' | 'live' | 'waiting' | 'error';
type Retry = { at: number; now: () => void } | null;

const MANIFEST_POLL_MS = 5000;
// No new segment and no playback progress for this long means the encoder stopped.
const STALE_AFTER_MS = 20_000;
const WHEP_RETRY_BASE_MS = 10_000;
const WHEP_RETRY_MAX_MS = 120_000;
const LAB_STATUS_POLL_MS = 15_000;

// WebRTC (WHEP) is the primary path; the HLS mirror is optional. Production
// sets only WHEP, so a WHEP-only config must stand on its own.
// Click-to-watch unless `autoplay` (the /stream page); nothing connects before that.
export default function LabCamera({ autoplay = false, streamLink = true }: { autoplay?: boolean; streamLink?: boolean }) {
  const [watching, setWatching] = useState(autoplay);
  const footer = streamLink ? (
    <>
      <span className="bc-hint mono bc-grow">opens muted</span>
      <Link className="bc-mini" href="/stream">
        /stream ↗
      </Link>
    </>
  ) : undefined;
  if (!watching) {
    return (
      <PanelChrome status="idle" message="Radio lab." footer={footer} action={<Button variant="ghost" size="sm" onClick={() => setWatching(true)}>watch</Button>}>
        {null}
      </PanelChrome>
    );
  }
  if (WHEP_URL || HLS_URL) return <R2Panel whep={WHEP_URL} hls={HLS_URL} footer={footer} />;
  return <CloudflarePanel footer={footer} />;
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
  live: 'Radio lab.',
  starting: 'connecting…',
  waiting: 'Lab camera is off.',
  unavailable: 'Lab camera is off.',
};

function R2Panel({ whep, hls, footer }: { whep?: string; hls?: string; footer?: ReactNode }) {
  const [status, setStatus] = useState<StreamStatus>('loading');
  const [message, setMessage] = useState('connecting…');
  const [retry, setRetry] = useState<Retry>(null);
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
    setRetry(null);
    setStatus('live');
    setMessage('Radio lab.');
  }, []);

  const whepDown = useCallback(() => {
    const delay = Math.min(WHEP_RETRY_BASE_MS * 2 ** failures.current++, WHEP_RETRY_MAX_MS);
    if (hls) {
      setMode('hls');
    } else {
      setMode('idle');
      setStatus('waiting');
      setMessage('Connection lost.');
    }
    const reconnect = () => {
      clearTimeout(retryTimer.current);
      setRetry(null);
      setSession((n) => n + 1);
      setMode('webrtc');
    };
    clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(reconnect, delay);
    if (!hls) setRetry({ at: Date.now() + delay, now: reconnect });
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
    <PanelChrome status={status} message={message} retry={retry} footer={footer}>
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

function CloudflarePanel({ footer }: { footer?: ReactNode }) {
  const [status, setStatus] = useState<StreamStatus>('loading');
  const [message, setMessage] = useState('connecting…');
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
          setMessage('No stream configured.');
        } else if (next.live === false) {
          setStatus('waiting');
          setMessage('Lab camera is off.');
        } else {
          setStatus('live');
          setMessage('Radio lab.');
        }
      } catch {
        if (ctrl.signal.aborted) return;
        setStatus('error');
        setMessage("Can't reach the lab camera.");
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
    <PanelChrome status={status} message={message} footer={footer}>
      {status === 'live' && iframeSrc && (
        <iframe
          src={iframeSrc}
          title="lab camera"
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
  retry,
  footer,
  action,
}: {
  status: StreamStatus | 'idle';
  message: string;
  children: ReactNode;
  retry?: Retry;
  footer?: ReactNode;
  action?: ReactNode;
}) {
  const now = useNow(status === 'idle' || status === 'live' ? 0 : 1000);
  const [since] = useState(() => Date.now());
  const tag =
    status === 'live' ? <StatusTag status="live" /> : status === 'error' || status === 'waiting' ? <StatusTag status="offline" /> : null;
  let line: ReactNode = message;
  if (status === 'loading' && now !== null) line = `connecting… ${Math.max(0, Math.round((now - since) / 1000))}s`;
  if (retry && now !== null) line = `${message} Retrying in ${Math.max(0, Math.ceil((retry.at - now) / 1000))}s.`;
  return (
    <Panel title="lab camera" actions={<>{tag}{status === 'live' && <StreamLikeButton />}</>} footer={footer} flush>
      <div className="video-frame">
        {children}
        {status !== 'live' && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div className="bc-row">
              <span className="bc-small" role="status">
                {line}
              </span>
              {action}
              {retry && (
                <Button variant="ghost" size="sm" onClick={retry.now}>
                  retry now
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
