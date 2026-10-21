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

// Sequence of the newest segment: media sequence plus segments listed after it.
export function liveEdge(media: string): number | null {
  const m = /#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(media);
  if (!m) return null;
  const segments = media.split(/\r?\n/).filter((l) => l.startsWith('#EXTINF')).length;
  return Number(m[1]) + segments;
}
