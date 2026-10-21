'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button } from '@bunkercoin/ui';
import { LIKE_WS_URL } from '@/lib/config';

// Likes fan out to the lab overlay only; the explorer never renders hearts.
const FLUSH_DEBOUNCE_MS = 400;
const MAX_LIKES_PER_MESSAGE = 25;

export default function StreamLikeButton() {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Send-only socket: taps reach the lab overlay; nothing renders here.
  useEffect(() => {
    if (!LIKE_WS_URL) return;
    let cancelled = false;
    let retryMs = 1000;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(LIKE_WS_URL as string);
      wsRef.current = ws;
      ws.onopen = () => {
        retryMs = 1000;
      };
      ws.onclose = () => {
        // A stale close (strict-mode remount) must not clobber the live socket.
        if (wsRef.current === ws) wsRef.current = null;
        if (!cancelled) {
          window.setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 10_000);
        }
      };
    }

    connect();
    // Keepalive: defeats NAT/idle timeouts so taps are never dropped on a zombie socket.
    const ka = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send('{"ping":1}');
    }, 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(ka);
      wsRef.current?.close();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const flush = useCallback(() => {
    const ws = wsRef.current;
    const count = Math.min(pendingRef.current, MAX_LIKES_PER_MESSAGE);
    if (count <= 0) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pendingRef.current = 0;
      return;
    }
    pendingRef.current -= count;
    ws.send(JSON.stringify({ likes: count }));
    if (pendingRef.current > 0) {
      flushTimerRef.current = setTimeout(flush, FLUSH_DEBOUNCE_MS);
    }
  }, []);

  const onLike = useCallback(() => {
    if (LIKE_WS_URL) {
      pendingRef.current += 1;
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (pendingRef.current >= MAX_LIKES_PER_MESSAGE) {
        flush();
      } else {
        flushTimerRef.current = setTimeout(flush, FLUSH_DEBOUNCE_MS);
      }
    }
  }, [flush]);

  return (
    <Button variant="ghost" size="sm" onClick={onLike} title="likes show on the lab screen" aria-label="like · likes show on the lab screen">
      like
    </Button>
  );
}
