import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Wrap an expensive fetcher with KV caching that serves stale data
 * while refreshing in the background.
 *
 * @param key        KV key to store the payload under
 * @param maxAgeMs   How long (in ms) a cached entry is considered FRESH
 * @param fetcher    Function that returns fresh data when cache is missing/stale
 * @returns          A Response containing JSON payload
 */
export async function withKvCache<T>(
  key: string,
  maxAgeMs: number,
  fetcher: () => Promise<T>,
  isValid?: (data: T) => boolean,
  maxAttempts: number = 3,
  retryDelayMs: number = 10_000,
): Promise<Response> {
  const { env, ctx } = getCloudflareContext();
  const kv = (env as any)["BUNKERCOIN_APP_CACHE"] as any;

  const headers = {
    "content-type": "application/json",
    "Cache-Control": `max-age=0, s-maxage=${Math.floor(maxAgeMs / 1000)}`,
  };

  // Attempt to read from KV
  const cachedRaw = await kv.get(key);

  if (cachedRaw) {
    try {
      const cachedObj = JSON.parse(cachedRaw) as { cachedAt: number; data: T };
      const age = Date.now() - cachedObj.cachedAt;

      if (age < maxAgeMs) {
        // Fresh
        return new Response(JSON.stringify(cachedObj.data), { headers });
      }

      // Stale – trigger revalidation but serve stale data immediately
      ctx.waitUntil(
        (async () => {
          try {
            const fresh = await fetcher();
            await kv.put(key, JSON.stringify({ cachedAt: Date.now(), data: fresh }));
          } catch (err) {
            console.error("[KV-CACHE] background refresh failed", err);
          }
        })()
      );

      return new Response(JSON.stringify(cachedObj.data), {
        headers: { ...headers, "X-Cache": "stale" },
      });
    } catch (e) {
      console.error("[KV-CACHE] Failed to parse cached JSON", e);
      // fallthrough to fetch fresh
    }
  }

  // Cache miss – fetch fresh data, cache, and return
  let fresh: T | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    fresh = await fetcher();
    if (!isValid || isValid(fresh)) {
      await kv.put(key, JSON.stringify({ cachedAt: Date.now(), data: fresh }));
      return new Response(JSON.stringify(fresh), { headers });
    }
    // wait before next attempt
    await new Promise((res) => setTimeout(res, retryDelayMs));
  }

  // After attempts, return 503 to indicate not ready
  return new Response("Data not available", { status: 503, headers });
} 