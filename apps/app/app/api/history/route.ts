import { withKvCache } from "@/app/api/utils/kv-cache";
import { getPriceHistory } from "@/lib/solana";

export async function GET() {
  return withKvCache<{ time: string; price: number }[]>(
    "price-history",
    30 * 60 * 1000, // 30 minutes
    getPriceHistory,
    (arr) => Array.isArray(arr) && arr.length > 0
  );
} 