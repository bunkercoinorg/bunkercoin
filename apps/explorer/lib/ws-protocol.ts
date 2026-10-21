import { parseJson } from './json.ts';
import { asBlock, asRadioStats, int, obj, str } from './guards.ts';
import type { Block, RadioStats, SlotStatus } from './types.ts';

export type WsEvent =
  | { kind: 'slot'; block: Block }
  | { kind: 'status'; slot: number; hash: string; status: SlotStatus }
  | { kind: 'radio'; stats: RadioStats };

const STATUSES: readonly string[] = ['pending', 'proposed', 'notarized', 'finalized'];

function statusChange(o: Record<string, unknown>): WsEvent | null {
  const status = o.new_status;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  return { kind: 'status', slot: int(o.slot, 'status_change.slot'), hash: str(o.hash, 'status_change.hash'), status: status as SlotStatus };
}

// The node nests three serde-tagged enums that all write `type`, so the frame
// arrives with duplicate keys and the innermost tag wins: a slot update is a
// flat block (`type: "block" | "skip"`) and a status change is
// `type: "status_change"`. The nested form in docs/rpc_spec.md is accepted too.
export function parseWsMessage(data: string, now: number): WsEvent | null {
  let o: Record<string, unknown>;
  try {
    o = obj(parseJson(data), 'message');
  } catch {
    return null;
  }
  try {
    switch (o.type) {
      case 'block':
      case 'skip':
        return { kind: 'slot', block: asBlock(o, 'update_slot') };
      case 'status_change':
        return statusChange(o);
      case 'radio_stats':
        return { kind: 'radio', stats: asRadioStats(o, now) };
      case 'block_update':
        if (o.update_slot) return { kind: 'slot', block: asBlock(o.update_slot, 'update_slot') };
        if (o.status_change) return statusChange(obj(o.status_change, 'status_change'));
        return null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export const WS_MIN_BACKOFF_MS = 1000;
export const WS_MAX_BACKOFF_MS = 30_000;

// Exponential backoff with equal jitter: half fixed, half random.
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(WS_MAX_BACKOFF_MS, WS_MIN_BACKOFF_MS * 2 ** Math.max(0, attempt));
  return Math.max(WS_MIN_BACKOFF_MS, Math.round(ceiling / 2 + (random() * ceiling) / 2));
}
