/** The node reports seconds in some places and ms in others; normalize once at the API boundary. */
export function normalizeTimestampMs(n: number): number | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}

/** `4s`, `12m 40s`, `3h`, `2d`. Future instants read as `0s`. */
export function relativeAge(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `21:04:17 UTC`. */
export function utcClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** `8Ep5…suHx`; hex ids `7ffcc7…52bf`. Short values are returned whole. */
export function shortId(s: string): string {
  if (s.length <= 12) return s;
  return /^[0-9a-f]+$/i.test(s) ? `${s.slice(0, 6)}…${s.slice(-4)}` : `${s.slice(0, 4)}…${s.slice(-4)}`;
}
