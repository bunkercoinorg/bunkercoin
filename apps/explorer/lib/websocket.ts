'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { applyChainAtom, radioStatsAtom, wsStatusAtom } from './atoms';
import { applyLive, applyStatusChange } from './chain';
import { NODE_WS_URL } from './config';
import { backoffDelay, parseWsMessage } from './ws-protocol';

export function useWebSocket() {
  const applyChain = useSetAtom(applyChainAtom);
  const setStatus = useSetAtom(wsStatusAtom);
  const setRadioStats = useSetAtom(radioStatsAtom);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const detach = (sock: WebSocket) => {
      sock.onopen = sock.onmessage = sock.onerror = sock.onclose = null;
      if (sock.readyState === WebSocket.CONNECTING || sock.readyState === WebSocket.OPEN) sock.close();
    };

    const schedule = () => {
      clearTimeout(timer);
      if (!disposed) timer = setTimeout(connect, backoffDelay(attempt++));
    };

    function connect() {
      if (disposed) return;
      if (ws) detach(ws);
      setStatus('connecting');
      let sock: WebSocket;
      try {
        sock = new WebSocket(NODE_WS_URL);
      } catch {
        setStatus('closed');
        schedule();
        return;
      }
      ws = sock;
      sock.onopen = () => {
        attempt = 0;
        setStatus('open');
      };
      sock.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        const msg = parseWsMessage(event.data, Date.now());
        if (!msg) return;
        if (msg.kind === 'slot') applyChain((v) => applyLive(v, msg.block));
        else if (msg.kind === 'status') applyChain((v) => applyStatusChange(v, msg));
        else setRadioStats(msg.stats);
      };
      sock.onerror = () => sock.close();
      sock.onclose = () => {
        if (ws !== sock) return;
        ws = null;
        setStatus('closed');
        schedule();
      };
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (ws) detach(ws);
      ws = null;
    };
  }, [applyChain, setStatus, setRadioStats]);
}
