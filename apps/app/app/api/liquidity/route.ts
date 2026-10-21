import { withKvCache } from "@/app/api/utils/kv-cache";
import { getLiquidityPoolData, LiquidityInfo } from "@/lib/solana";


export async function GET() {
  return withKvCache<LiquidityInfo>(
    "liquidity-data",
    30 * 60 * 1000,
    getLiquidityPoolData,
    (info) => info && info.total > 0 && info.pools.length > 0
  );
} 