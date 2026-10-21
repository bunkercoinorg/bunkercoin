import { withKvCache } from "@/app/api/utils/kv-cache";
import { getBurnedTokenData } from "@/lib/solana";


export async function GET() {
  return withKvCache<number>(
    "burned-data",
    30 * 60 * 1000,
    getBurnedTokenData,
    (n) => typeof n === "number" && n > 0
  );
} 