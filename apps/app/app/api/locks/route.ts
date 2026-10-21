import { withKvCache } from "@/app/api/utils/kv-cache";
import { getLockData, LockSummary } from "@/lib/solana";


export async function GET() {
  return withKvCache<LockSummary>(
    "lock-data",
    30 * 60 * 1000,
    getLockData,
    (d) => d && typeof d === "object" && (d as LockSummary).totalLocked > 0
  );
} 