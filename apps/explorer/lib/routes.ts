type Query = Record<string, string | number | bigint | boolean | undefined>;

// Every caller-supplied segment and query value is encoded here, nowhere else.
export function buildPath(segments: (string | number | bigint)[], query?: Query): string {
  const path = '/' + segments.map((s) => encodeURIComponent(String(s))).join('/');
  const qs = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
}

export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path;
}

const page = (route: string, key: string, value: string | number | bigint) =>
  `/${route}?${key}=${encodeURIComponent(String(value))}`;

export const routes = {
  block: (id: string | number | bigint) => page('block', 'id', id),
  tx: (sig: string) => page('tx', 'sig', sig),
  account: (address: string) => page('account', 'address', address),
  token: (id: string) => page('token', 'id', id),
};

export const nodePaths = {
  blocks: (offset: number, limit: number) => buildPath(['blocks'], { offset, limit }),
  nodes: () => buildPath(['nodes']),
  block: (hash: string) => buildPath(['block', hash]),
  blockBySlot: (slot: string) => buildPath(['block', 'slot', slot]),
  transaction: (hash: string) => buildPath(['transactions', hash]),
  account: (pubkey: string) => buildPath(['accounts', pubkey]),
  token: (id: string) => buildPath(['tokens', id]),
  tokenHolders: (id: string, offset: number, limit: number) =>
    buildPath(['tokens', id, 'holders'], { offset, limit }),
};
