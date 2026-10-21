'use client';

import { useAtomValue } from 'jotai';
import { radioStatsAtom, wsStatusAtom } from '@/lib/atoms';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import { useNow } from '@/lib/use-now';

// The sampler publishes every 2s; a few missed frames means the feed is stale.
const RADIO_STALE_MS = 10_000;
const RETRY_WARN_PERCENT = 10;

function formatBps(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(2)} Mbps`;
  } else if (bps >= 1000) {
    return `${(bps / 1000).toFixed(2)} kbps`;
  }
  return `${bps.toFixed(0)} bps`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

export default function NetworkStats() {
  const radioStats = useAtomValue(radioStatsAtom);
  const wsStatus = useAtomValue(wsStatusAtom);
  const now = useNow();
  const live = radioStats !== null && wsStatus === 'open' && now - radioStats.received_at < RADIO_STALE_MS;
  const retryPercent = radioStats ? radioStats.packet_loss_rate_2s * 100 : 0;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-1 tracking-tight">
        Radio Network Statistics
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Radio network constraints and real-time performance metrics
      </p>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-lg bg-card/50 backdrop-blur p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
            <Activity size={16} className={live ? 'text-emerald-400' : ''} />
            {live ? 'Live Radio Network Stats (Last 30 Seconds)' : 'Radio Network Stats (Not Live)'}
          </h3>
          {radioStats ? (
            <div className={`space-y-2 text-sm ${live ? '' : 'opacity-60'}`}>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Packets</span>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Queued:</span>
                    <span className="text-white">{radioStats.packets_queued}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Sent:</span>
                    <span className="text-emerald-400">{radioStats.packets_sent_2s}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Retried:</span>
                    <span className="text-red-400">{radioStats.packets_dropped_2s}</span>
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Bytes Transmitted</span>
                <span className="font-mono">{formatBytes(radioStats.bytes_transmitted_2s)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Bytes Received</span>
                <span className="font-mono">{formatBytes(radioStats.bytes_received_2s)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Effective Throughput</span>
                <span className="font-mono text-emerald-400">{formatBps(radioStats.effective_throughput_bps_2s)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Retry Rate (ARQ)</span>
                <span className={`font-mono ${retryPercent > RETRY_WARN_PERCENT ? 'text-red-400' : ''}`}>
                  {retryPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          ) : wsStatus === 'closed' ? (
            <p className="text-sm text-muted-foreground">Radio telemetry is unavailable while the node connection is down.</p>
          ) : (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
} 