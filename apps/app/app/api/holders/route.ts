import { withKvCache } from "@/app/api/utils/kv-cache";
import { getTopHolders, TokenBalance } from "@/lib/solana";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(50, parseInt(limitParam, 10)) : 10;
  return withKvCache<TokenBalance[]>(
    `holders-${limit}`,
    30 * 60 * 1000, // 30 minutes
    () => getTopHolders(limit),
    (arr) => Array.isArray(arr) && arr.length > 0
  );
} 