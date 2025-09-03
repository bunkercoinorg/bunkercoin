import { withKvCache } from "@/app/api/utils/kv-cache";
import type { PriceData } from "@/lib/solana";


async function fetchPrice(): Promise<PriceData | null> {
  try {
    const resp = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bunkercoin&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true&include_market_cap=true"
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const token = data.bunkercoin;
    if (!token) return null;
    return {
      price: token.usd || 0,
      priceChange24h: token.usd_24h_change || 0,
      volume24h: token.usd_24h_vol || 0,
      marketCap: token.usd_market_cap || 0,
      high24h: 0,
      low24h: 0,
    };
  } catch (e) {
    console.error("[price] fetch error", e);
    return null;
  }
}

export async function GET() {
  // 10 minutes TTL
  return withKvCache<PriceData | null>("price-data", 10 * 60 * 1000, fetchPrice);
} 