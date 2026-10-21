'use client';

import { useEffect, useRef } from 'react';

interface WhepPlayerProps {
  src: string;
  onLive: () => void;
  onDown: () => void;
}

const ICE_GATHER_MS = 1000;
const CONNECT_DEADLINE_MS = 15_000;

// Sub-second live view over WebRTC (WHEP). Reports up or down exactly once per
// failure; the panel decides whether to retry or fall back to HLS.
export default function WhepPlayer({ src, onLive, onDown }: WhepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onLiveRef = useRef(onLive);
  const onDownRef = useRef(onDown);

  useEffect(() => {
    onLiveRef.current = onLive;
    onDownRef.current = onDown;
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let closed = false;
    const ctrl = new AbortController();
    const pc = new RTCPeerConnection();
    const stream = new MediaStream();
    let iceTimer: ReturnType<typeof setTimeout> | undefined;

    const teardown = () => {
      closed = true;
      ctrl.abort();
      clearTimeout(iceTimer);
      clearTimeout(deadline);
      pc.ontrack = pc.onconnectionstatechange = pc.onicegatheringstatechange = null;
      pc.getReceivers().forEach((r) => r.track?.stop());
      pc.close();
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };

    const fail = () => {
      if (closed) return;
      teardown();
      onDownRef.current();
    };

    const deadline = setTimeout(() => {
      if (pc.connectionState !== 'connected') fail();
    }, CONNECT_DEADLINE_MS);

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = (e) => {
      stream.addTrack(e.track);
      if (video.srcObject !== stream) video.srcObject = stream;
      void video.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearTimeout(deadline);
        onLiveRef.current();
      }
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) fail();
    };

    void (async () => {
      try {
        await pc.setLocalDescription(await pc.createOffer());
        // WHEP is trickle-less here: wait briefly for ICE gathering to finish.
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve();
          iceTimer = setTimeout(resolve, ICE_GATHER_MS);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(iceTimer);
              resolve();
            }
          };
        });
        if (closed) return;
        const res = await fetch(src, {
          method: 'POST',
          headers: { 'content-type': 'application/sdp' },
          body: pc.localDescription?.sdp,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`whep ${res.status}`);
        const answer = await res.text();
        if (closed) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      } catch {
        fail();
      }
    })();

    return teardown;
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
