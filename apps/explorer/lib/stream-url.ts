// Host patterns are exact hosts or `*.suffix` wildcards; only https is allowed.
export const DEFAULT_STREAM_HOSTS = ['*.cloudflarestream.com', 'iframe.videodelivery.net'];

export function parseHostList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) return host.endsWith(pattern.slice(1)) && host.length > pattern.length - 1;
  return host === pattern;
}

// Returns the normalized URL when it is an https URL on an allowed host.
export function allowedStreamUrl(raw: string | null | undefined, hosts: string[]): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  return hosts.some((p) => hostMatches(host, p)) ? url.toString() : null;
}

export function withQuery(raw: string, params: Record<string, string>): string {
  const url = new URL(raw);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}
