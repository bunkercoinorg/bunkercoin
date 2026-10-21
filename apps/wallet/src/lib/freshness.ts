export type Resource = 'balance' | 'tokens' | 'slot' | 'history' | 'fee';

export const RESOURCES: Resource[] = ['balance', 'tokens', 'slot', 'history', 'fee'];

export interface Freshness {
  /** Last successful answer. */
  okAt: number | null;
  /** Set while the newest request for the resource is failing. */
  error: string | null;
}

export type FreshnessMap = Record<Resource, Freshness>;

export type ConnectionStatus = 'connecting' | 'live' | 'partial' | 'stale' | 'offline';

export const initialFreshness = (): FreshnessMap =>
  Object.fromEntries(RESOURCES.map((r) => [r, { okAt: null, error: null }])) as FreshnessMap;

/** The balance decides reachability; any other failing resource downgrades 'live' to 'partial'. */
export function connectionStatus(f: FreshnessMap): { status: ConnectionStatus; failing: Resource[] } {
  const failing = RESOURCES.filter((r) => f[r].error !== null);
  const balance = f.balance;
  if (balance.error !== null) return { status: balance.okAt === null ? 'offline' : 'stale', failing };
  if (balance.okAt === null) return { status: 'connecting', failing };
  return { status: failing.length > 0 ? 'partial' : 'live', failing };
}
