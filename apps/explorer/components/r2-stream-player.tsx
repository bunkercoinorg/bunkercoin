'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface Props {
  src: string;
  onProgress: () => void;
  onFatal: () => void;
}

const MAX_NETWORK_RETRIES = 5;
const RETRY_BASE_MS = 1000;

// Plays the R2-backed live HLS stream; Safari uses its native HLS support.
// `onProgress` fires while playback advances, `onFatal` once it gives up.
export default function R2StreamPlayer({ src, onProgress, onFatal }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onProgressRef = useRef(onProgress);
  const onFatalRef = useRef(onFatal);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onFatalRef.current = onFatal;
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // React can drop the muted attribute; Safari only autoplays muted video.
    video.defaultMuted = true;
    video.muted = true;
    const play = () => void video.play().catch(() => {});
    const progress = () => onProgressRef.current();
    const fatal = () => {
      if (disposed) return;
      disposed = true;
      onFatalRef.current();
    };
    video.addEventListener('timeupdate', progress);

    const releaseVideo = () => {
      video.removeEventListener('timeupdate', progress);
      video.removeEventListener('loadedmetadata', play);
      video.removeEventListener('canplay', play);
      video.removeEventListener('error', fatal);
      video.removeAttribute('src');
      video.load();
    };

    // Prefer hls.js everywhere it runs (incl. desktop Safari); native HLS is
    // the fallback for older iOS and autoplays less reliably.
    if (!Hls.isSupported()) {
      video.addEventListener('loadedmetadata', play, { once: true });
      video.addEventListener('canplay', play, { once: true });
      video.addEventListener('error', fatal);
      video.src = src;
      return () => {
        disposed = true;
        releaseVideo();
      };
    }

    const hls = new Hls({
      // Ride ~2 segments behind the live edge; drift back gets replayed at 1.1x.
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 6,
      maxLiveSyncPlaybackRate: 1.1,
      backBufferLength: 30,
    });
    let networkRetries = 0;
    let mediaRecovered = false;
    hls.on(Hls.Events.MANIFEST_PARSED, play);
    hls.on(Hls.Events.FRAG_LOADED, () => {
      networkRetries = 0;
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal || disposed) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_NETWORK_RETRIES) {
        const delay = RETRY_BASE_MS * 2 ** networkRetries++;
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => !disposed && hls.startLoad(), delay);
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
        mediaRecovered = true;
        hls.recoverMediaError();
      } else {
        fatal();
      }
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      hls.destroy();
      releaseVideo();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="absolute left-0 top-0 h-full w-full bg-black"
      autoPlay
      muted
      playsInline
      controls
    />
  );
}
