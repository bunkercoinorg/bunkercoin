// Minimal playlist reading for liveness checks: a live master playlist never
// changes, so freshness has to come from the media playlist's sequence number.

export function isMasterPlaylist(text: string): boolean {
  return text.includes('#EXT-X-STREAM-INF');
}

export function firstVariantUrl(master: string, base: string): string | null {
  const lines = master.split(/\r?\n/).map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
    const uri = lines.slice(i + 1).find((l) => l && !l.startsWith('#'));
    if (!uri) return null;
    try {
      return new URL(uri, base).toString();
    } catch {
      return null;
    }
  }
  return null;
}

export const isPlaylist = (text: string) => text.trimStart().startsWith('#EXTM3U');

// Sequence of the newest segment: media sequence plus segments listed after it.
// Without an explicit sequence the edge is unknown, and playback decides.
export function liveEdge(media: string): number | 'unknown' {
  const m = /#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(media);
  if (!m) return 'unknown';
  const segments = media.split(/\r?\n/).filter((l) => l.startsWith('#EXTINF')).length;
  return Number(m[1]) + segments;
}

// A failed probe (`ok: false`) is transient: it never unmounts a playing player.
export type HlsProbe = { ok: false } | { ok: true; edge: number | 'unknown' };

export interface HlsWatch {
  edge: number | null;
  edgeAt: number;
  brokenAt: number | null;
  mounted: boolean;
  playerKey: number;
}

export type HlsView = 'live' | 'starting' | 'waiting' | 'unavailable';

export const initialHlsWatch: HlsWatch = { edge: null, edgeAt: 0, brokenAt: null, mounted: false, playerKey: 0 };

// Fresh means a new segment or playback progress within `staleMs`. A player
// that gave up is remounted once the edge moves, or after `staleMs` when the
// edge is unknown.
export function assessHls(
  w: HlsWatch,
  probe: HlsProbe,
  progressAt: number,
  now: number,
  staleMs: number,
): { watch: HlsWatch; view: HlsView } {
  let { edge, edgeAt, brokenAt, playerKey } = w;
  const unknown = probe.ok && probe.edge === 'unknown';
  let advanced = false;
  if (probe.ok && probe.edge !== 'unknown' && probe.edge !== edge) {
    edge = probe.edge;
    edgeAt = now;
    advanced = true;
  }
  if (brokenAt !== null && (advanced || (unknown && now - brokenAt >= staleMs))) {
    brokenAt = null;
    playerKey++;
  }
  const fresh = now - Math.max(edgeAt, progressAt) < staleMs;
  const mounted = brokenAt === null && (fresh || unknown || (!probe.ok && w.mounted));
  const view: HlsView = mounted ? (fresh ? 'live' : 'starting') : probe.ok ? 'waiting' : 'unavailable';
  return { watch: { edge, edgeAt, brokenAt, mounted, playerKey }, view };
}
