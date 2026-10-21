import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";
import worker from "../src/index.ts";
import type { Env } from "../src/index.ts";
import type { MetadataDocument } from "../src/validate.ts";
import { canonicalize } from "../src/canonical.ts";
import { sha256 } from "../src/hash.ts";
import { png, webp } from "./fixtures.ts";

interface Stored {
  bytes: Uint8Array;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

class Bucket {
  objects = new Map<string, Stored>();
  writes: string[] = [];
  reads: string[] = [];

  async head(key: string) {
    this.reads.push(key);
    return this.objects.get(key) ?? null;
  }

  async put(key: string, value: string | Uint8Array | ReadableStream, options: Omit<Stored, "bytes"> = {}) {
    this.writes.push(key);
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) :
      value instanceof Uint8Array ? value.slice() : new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, { ...options, bytes });
  }

  async get(key: string) {
    this.reads.push(key);
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      ...stored,
      size: stored.bytes.length,
      body: new Response(stored.bytes).body,
      json: async () => JSON.parse(new TextDecoder().decode(stored.bytes)),
      text: async () => new TextDecoder().decode(stored.bytes),
    };
  }
}

function setup(t: TestContext, nodeResponse: (url: URL) => unknown = () => ({ tokens: [] })) {
  const bucket = new Bucket();
  const entries = new Map<string, Response>();
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  const cache = {
    match: async (request: Request) => entries.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => { entries.set(request.url, response.clone()); },
  };
  Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: cache } });
  t.after(() => {
    if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
    else Reflect.deleteProperty(globalThis, "caches");
  });
  const node = t.mock.method(globalThis, "fetch", async (request: Request) => {
    const value = nodeResponse(new URL(request.url));
    return value instanceof Response ? value : Response.json(value);
  });
  const ips: string[] = [];
  const promoteIps: string[] = [];
  const env: Env = {
    METADATA: bucket as unknown as Env["METADATA"],
    UPLOAD_LIMIT: { limit: async ({ key }) => { ips.push(key); return { success: true }; } },
    PROMOTE_LIMIT: { limit: async ({ key }) => { promoteIps.push(key); return { success: true }; } },
    ALLOW_LOCALHOST: "true",
    NODE_API_URL: "https://node.test",
    ALLOWED_ORIGINS: "https://wallet.bunkercoin.com,https://explorer.bunkercoin.com",
  };
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (promise: Promise<unknown>) => waits.push(promise) };
  async function send(path: string, init?: RequestInit) {
    const response = await worker.fetch(new Request(`https://metadata.test${path}`, init), env, ctx as never);
    await Promise.all(waits);
    return response;
  }
  return { bucket, env, send, node, ips, promoteIps, entries };
}

function form(bytes?: Uint8Array): FormData {
  const body = new FormData();
  body.set("name", "Coin");
  body.set("description", "");
  if (bytes) body.set("image", new Blob([new Uint8Array(bytes)], { type: "text/html" }), "untrusted.svg");
  return body;
}

test("upload is content addressed and idempotent and keeps pending images private", async (t) => {
  const app = setup(t);
  const first = await app.send("/v1/metadata", { method: "POST", body: form(png()), headers: { "CF-Connecting-IP": "192.0.2.1" } });
  assert.equal(first.status, 200);
  const { hash, document } = await first.json<{ hash: string; document: MetadataDocument & { image: NonNullable<MetadataDocument["image"]> } }>();
  assert.equal(document.image.type, "image/png");
  assert.equal(document.image.sha256, await sha256(png()));
  assert.equal("token_id" in document, false);
  const pending = app.bucket.objects.get(`pending/${hash}.json`)!;
  assert.equal(new TextDecoder().decode(pending.bytes), canonicalize(document));
  assert.ok(pending.customMetadata?.created);
  assert.ok(app.bucket.objects.has(`pending-img/${document.image.sha256}`));
  assert.equal(app.bucket.objects.has(`img/${document.image.sha256}`), false);
  assert.deepEqual(app.ips, ["192.0.2.1"]);
  const before = app.bucket.writes.length;
  const second = await app.send("/v1/metadata", { method: "POST", body: form(png()) });
  assert.deepEqual(await second.json(), { hash, document });
  assert.equal(app.bucket.writes.length, before);
  const image = await app.send(`/v1/images/${document.image.sha256}`);
  assert.equal(image.status, 404);
  const metadata = await app.send(`/v1/metadata/${hash}`);
  assert.equal(metadata.status, 404);
  assert.equal(metadata.headers.get("Cache-Control"), "no-store");
  assert.equal(app.bucket.objects.has(`final/${hash}.json`), false);
});

test("on-chain metadata is promoted before images become public and final reads skip the node", async (t) => {
  let registered = "";
  const app = setup(t, () => ({ tokens: [{ metadata_hash: registered.toUpperCase() }] }));
  const uploaded = await app.send("/v1/metadata", { method: "POST", body: form(webp("VP8L")) });
  const { hash, document } = await uploaded.json<{ hash: string; document: MetadataDocument & { image: NonNullable<MetadataDocument["image"]> } }>();
  registered = hash;
  const response = await app.send(`/v1/metadata/${hash}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), canonicalize(document));
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.ok(app.bucket.writes.indexOf(`img/${document.image.sha256}`) < app.bucket.writes.indexOf(`final/${hash}.json`));
  assert.ok(app.bucket.writes.indexOf(`final/${hash}.json`) < app.bucket.writes.indexOf(`final-img/${document.image.sha256}`));
  assert.equal((await app.send(`/v1/metadata/${hash.toUpperCase()}`)).status, 200);
  assert.equal(app.node.mock.callCount(), 1);
  const image = await app.send(`/v1/images/${document.image.sha256}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("Content-Type"), "image/webp");
  assert.equal(image.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(image.headers.get("Content-Security-Policy"), "default-src 'none'; sandbox");
  assert.equal(image.headers.get("Cross-Origin-Resource-Policy"), "cross-origin");
  assert.equal(image.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), webp("VP8L"));
  app.entries.clear(); // Exercise repair after an edge cache miss.
  app.bucket.objects.delete(`final-img/${document.image.sha256}`);
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 200);
  assert.ok(app.bucket.objects.has(`final-img/${document.image.sha256}`));
});

test("token lookups cache positive and negative snapshots for 30 seconds", async (t) => {
  const app = setup(t);
  const upload = await app.send("/v1/metadata", { method: "POST", body: form() });
  const { hash } = await upload.json<{ hash: string }>();
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 404);
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 404);
  assert.equal(app.node.mock.callCount(), 1);
  assert.equal([...app.entries.values()][0].headers.get("Cache-Control"), "public, max-age=30");
});

test("follows offset/total pagination and matches hashes on later pages", async (t) => {
  let hash = "";
  const offsets: string[] = [];
  const app = setup(t, (url) => {
    const offset = url.searchParams.get("offset")!;
    offsets.push(offset);
    return { tokens: [{ metadata_hash: offset === "0" ? "f".repeat(64) : hash }], offset: Number(offset), limit: 1, total: 2 };
  });
  const response = await app.send("/v1/metadata", { method: "POST", body: form() });
  hash = (await response.json<{ hash: string }>()).hash;
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 200);
  assert.deepEqual(offsets, ["0", "1"]);
});

test("accepts bare token arrays and rejects malformed or failing node responses", async (t) => {
  let value: unknown = [];
  const app = setup(t, () => value);
  const uploaded = await app.send("/v1/metadata", { method: "POST", body: form() });
  const { hash } = await uploaded.json<{ hash: string; document: MetadataDocument & { image: NonNullable<MetadataDocument["image"]> } }>();
  value = { unexpected: [] };
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  app.entries.clear();
  value = new Response("offline", { status: 503 });
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  app.entries.clear();
  value = new Response("not json");
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  app.entries.clear();
  value = [{ metadata_hash: hash }];
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 200);
});

test("stops non-advancing pagination without publishing metadata", async (t) => {
  const app = setup(t, () => ({ tokens: [{ metadata_hash: "0".repeat(64) }], total: 3, limit: 1 }));
  const uploaded = await app.send("/v1/metadata", { method: "POST", body: form() });
  const { hash } = await uploaded.json<{ hash: string; document: MetadataDocument & { image: NonNullable<MetadataDocument["image"]> } }>();
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  assert.equal(app.node.mock.callCount(), 2);
  assert.equal(app.bucket.objects.has(`final/${hash}.json`), false);
});

test("rejects disallowed origins and supports allowed preflight and localhost", async (t) => {
  const app = setup(t);
  for (const origin of ["https://wallet.bunkercoin.com", "https://explorer.bunkercoin.com", "http://localhost:3000"]) {
    const response = await app.send("/v1/metadata", { method: "OPTIONS", headers: { Origin: origin } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
    assert.equal(response.headers.get("Vary"), "Origin");
  }
  for (const origin of ["https://evil.test", "http://localhost.evil.test:3000", "http://localhost:99999"]) {
    const response = await app.send("/v1/metadata", { method: "POST", headers: { Origin: origin }, body: form() });
    assert.equal(response.status, 403);
    assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  }
  const health = await app.send("/health", { headers: { Origin: "https://evil.test" } });
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal(health.headers.has("Access-Control-Allow-Origin"), false);
});

test("rate limits per IP before reading an upload body", async (t) => {
  const app = setup(t);
  let key = "";
  app.env.UPLOAD_LIMIT.limit = async (options) => { key = options.key; return { success: false }; };
  const response = await app.send("/v1/metadata", { method: "POST", headers: { "CF-Connecting-IP": "192.0.2.9" }, body: "not multipart" });
  assert.equal(response.status, 429);
  assert.equal(key, "192.0.2.9");
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal((await response.json<{ code: string }>()).code, "RATE_LIMITED");
  assert.equal(app.bucket.objects.size, 0);
});

test("rejects duplicate and unknown fields, malformed strings and forbidden image bytes", async (t) => {
  const app = setup(t);
  const duplicate = form();
  duplicate.append("name", "Another");
  const unknown = form();
  unknown.set("token_id", "not allowed");
  const invalidName = form();
  invalidName.set("name", "e\u0301");
  for (const body of [duplicate, unknown, invalidName, form(new TextEncoder().encode("<svg/>"))]) {
    const response = await app.send("/v1/metadata", { method: "POST", body });
    assert.equal(response.status, 400);
    assert.equal((await response.json<{ code: string }>()).code, "INVALID_METADATA");
  }
  assert.equal(app.bucket.objects.size, 0);
});

test("bounds multipart streams and image files and rejects wrong content types", async (t) => {
  const app = setup(t);
  const wrongType = await app.send("/v1/metadata", { method: "POST", body: "hello" });
  assert.equal(wrongType.status, 415);
  const largeImage = new Uint8Array(256 * 1024 + 1);
  largeImage.set(png());
  assert.equal((await app.send("/v1/metadata", { method: "POST", body: form(largeImage) })).status, 413);
  const oversized = await app.send("/v1/metadata", { method: "POST", body: new Uint8Array(273 * 1024), headers: { "Content-Type": "multipart/form-data; boundary=x" } });
  assert.equal(oversized.status, 413);
  const malformed = await app.send("/v1/metadata", { method: "POST", body: "broken", headers: { "Content-Type": "multipart/form-data; boundary=x" } });
  assert.equal(malformed.status, 400);
  assert.equal(app.bucket.objects.size, 0);
});

test("does not contact the node for unknown hashes or expose corrupt stored metadata", async (t) => {
  const app = setup(t, () => ({ tokens: [{ metadata_hash: "f".repeat(64) }] }));
  assert.equal((await app.send(`/v1/metadata/${"f".repeat(64)}`)).status, 404);
  assert.equal(app.node.mock.callCount(), 0);
  await app.bucket.put(`pending/${"f".repeat(64)}.json`, canonicalize({ v: 1, name: "Coin", description: "", image: null }));
  assert.equal((await app.send(`/v1/metadata/${"f".repeat(64)}`)).status, 500);
  assert.equal(app.bucket.objects.has(`final/${"f".repeat(64)}.json`), false);
  assert.equal((await app.send("/v1/metadata/not-a-hash")).status, 404);
  assert.equal((await app.send("/v1/images/not-a-hash")).status, 404);
});

test("uses the same IPv6 /64 key for equivalent addresses and leaves IPv4 unchanged", async (t) => {
  const app = setup(t);
  for (const ip of [
    "2001:0DB8:ABCD:0001::1", "2001:db8:abcd:1:ffff::2",
    "2001:db8:abcd:1::192.0.2.1", "::1", "0:0:0:0:0:0:0:2", "192.0.2.1",
  ]) {
    assert.equal((await app.send("/v1/metadata", { method: "POST", body: form(), headers: { "CF-Connecting-IP": ip } })).status, 200);
  }
  assert.deepEqual(app.ips, [
    "2001:db8:abcd:1::/64", "2001:db8:abcd:1::/64", "2001:db8:abcd:1::/64",
    "0:0:0:0::/64", "0:0:0:0::/64", "192.0.2.1",
  ]);
});

test("limits pending promotions separately before node lookup and skips the limiter for unknown/final hashes", async (t) => {
  let registered = "";
  const app = setup(t, () => ({ tokens: [{ metadata_hash: registered }] }));
  const upload = await app.send("/v1/metadata", { method: "POST", body: form() });
  const { hash } = await upload.json<{ hash: string }>();
  app.env.PROMOTE_LIMIT.limit = async ({ key }) => { app.promoteIps.push(key); return { success: false }; };
  const response = await app.send(`/v1/metadata/${hash}`, { headers: { "CF-Connecting-IP": "2001:db8::f" } });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(app.promoteIps, ["2001:db8:0:0::/64"]);
  assert.equal(app.node.mock.callCount(), 0);
  assert.equal(app.ips.length, 1);
  assert.equal((await app.send(`/v1/metadata/${"f".repeat(64)}`)).status, 404);
  assert.equal(app.promoteIps.length, 1);
  registered = hash;
  app.env.PROMOTE_LIMIT.limit = async () => ({ success: true });
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 200);
  app.entries.clear();
  app.env.PROMOTE_LIMIT.limit = async () => { throw new Error("Final reads must skip promotion limiter"); };
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 200);
});

for (const failure of ["network", "http", "json", "shape", "token", "pagination"] as const) {
  test(`caches ${failure} node failures for ten seconds without caching malformed success data`, async (t) => {
    const app = setup(t, () => {
      if (failure === "network") throw new Error("offline");
      if (failure === "http") return new Response("offline", { status: 503 });
      if (failure === "json") return new Response("invalid json");
      if (failure === "shape") return { unexpected: [] };
      if (failure === "token") return { tokens: [{ metadata_hash: 42 }] };
      return { tokens: [], has_more: "yes" };
    });
    const upload = await app.send("/v1/metadata", { method: "POST", body: form() });
    const { hash } = await upload.json<{ hash: string }>();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.send(`/v1/metadata/${hash}`);
      assert.equal(response.status, 502);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
    assert.equal(app.node.mock.callCount(), 1);
    const [[key, cached]] = [...app.entries];
    assert.equal(new URL(key).origin, "https://metadata.bunkercoin.com");
    assert.equal(new URL(key).pathname, "/__cache/tokens");
    assert.equal(cached.status, 502);
    assert.equal(cached.headers.get("Cache-Control"), "public, max-age=10");
    app.entries.clear(); // Simulate expiry; another attempt must retry the node.
    assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
    assert.equal(app.node.mock.callCount(), 2);
  });
}

test("stops token pagination at twenty pages", async (t) => {
  const app = setup(t, (url) => ({
    tokens: [{ metadata_hash: Number(url.searchParams.get("offset")).toString(16).padStart(64, "0") }],
    has_more: true,
  }));
  const upload = await app.send("/v1/metadata", { method: "POST", body: form() });
  const { hash } = await upload.json<{ hash: string }>();
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  assert.equal(app.node.mock.callCount(), 20);
  assert.equal(app.bucket.objects.has(`final/${hash}.json`), false);
});

test("caps token scans at ten thousand tokens and refuses oversized pages", async (t) => {
  let size = 10_000;
  const app = setup(t, () => ({ tokens: Array.from({ length: size }, (_, index) => ({
    metadata_hash: index.toString(16).padStart(64, "0"),
  })), has_more: true }));
  const upload = await app.send("/v1/metadata", { method: "POST", body: form() });
  const { hash } = await upload.json<{ hash: string }>();
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  assert.equal(app.node.mock.callCount(), 1);
  app.entries.clear();
  size++;
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  assert.equal(app.node.mock.callCount(), 2);
  assert.equal([...app.entries.values()][0].status, 502);
  assert.equal(app.bucket.objects.has(`final/${hash}.json`), false);
});

test("enforces the cumulative token budget across pages before matching", async (t) => {
  let hash = "";
  const app = setup(t, (url) => ({ tokens: Array.from({ length: 6000 }, (_, index) => ({
    metadata_hash: url.searchParams.get("offset") === "0" ? index.toString(16).padStart(64, "0") : hash,
  })), has_more: true }));
  const upload = await app.send("/v1/metadata", { method: "POST", body: form() });
  hash = (await upload.json<{ hash: string }>()).hash;
  assert.equal((await app.send(`/v1/metadata/${hash}`)).status, 502);
  assert.equal(app.node.mock.callCount(), 2);
  assert.equal(app.bucket.objects.has(`final/${hash}.json`), false);
});

test("localhost CORS requires the development opt-in", async (t) => {
  const app = setup(t);
  for (const flag of [undefined, "false", "true"]) {
    app.env.ALLOW_LOCALHOST = flag;
    for (const origin of ["http://localhost", "http://localhost:3000"]) {
      const response = await app.send("/v1/metadata", { method: "OPTIONS", headers: { Origin: origin } });
      assert.equal(response.status, flag === "true" ? 204 : 403);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), flag === "true" ? origin : null);
    }
    assert.equal((await app.send("/health", { headers: { Origin: "https://wallet.bunkercoin.com" } })).headers.get("Access-Control-Allow-Origin"), "https://wallet.bunkercoin.com");
  }
});

test("an empty unnamed file part means no image; a named empty file is invalid", async (t) => {
  const app = setup(t);
  const body = form();
  // Node's FormData serializer omits filename=""; browsers send it explicitly.
  const multipart = '--empty-file\r\nContent-Disposition: form-data; name="name"\r\n\r\nCoin\r\n' +
    '--empty-file\r\nContent-Disposition: form-data; name="description"\r\n\r\n\r\n' +
    '--empty-file\r\nContent-Disposition: form-data; name="image"; filename=""\r\n' +
    'Content-Type: application/octet-stream\r\n\r\n\r\n--empty-file--\r\n';
  const response = await app.send("/v1/metadata", {
    method: "POST", body: multipart, headers: { "Content-Type": "multipart/form-data; boundary=empty-file" },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json<{ document: MetadataDocument }>()).document.image, null);
  body.set("image", new Blob([]), "empty.png");
  assert.equal((await app.send("/v1/metadata", { method: "POST", body })).status, 400);
});

for (const corrupt of ["{", '{"v":2}', '{"v":1,"name":"Coin","description":"","image":null}']) {
  test(`corrupt stored documents return an integrity error: ${corrupt}`, async (t) => {
    const app = setup(t);
    const hash = "f".repeat(64);
    for (const prefix of ["pending", "final"]) {
      await app.bucket.put(`${prefix}/${hash}.json`, corrupt);
      const response = await app.send(`/v1/metadata/${hash}`);
      assert.equal(response.status, 500);
      assert.equal((await response.json<{ code: string }>()).code, "INTEGRITY_ERROR");
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
    assert.equal(app.node.mock.callCount(), 0);
  });
}

test("unexpected storage errors return 500 instead of 503", async (t) => {
  const app = setup(t);
  app.bucket.get = async () => { throw new Error("storage failure"); };
  const response = await app.send(`/v1/metadata/${"f".repeat(64)}`);
  assert.equal(response.status, 500);
  assert.equal((await response.json<{ code: string }>()).code, "INTERNAL_ERROR");
});

test("every response has nosniff and JSON responses have a restrictive CSP", async (t) => {
  const app = setup(t);
  const responses = [
    await app.send("/health"),
    await app.send("/v1/metadata", { method: "POST", body: form() }),
    await app.send("/missing"),
    await app.send("/v1/metadata", { method: "OPTIONS", headers: { Origin: "https://wallet.bunkercoin.com" } }),
  ];
  for (const response of responses) {
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    if (response.headers.get("Content-Type")?.startsWith("application/json")) {
      assert.equal(response.headers.get("Content-Security-Policy"), "default-src 'none'");
    }
  }
});

test("known routes reject HEAD and other wrong methods with Allow", async (t) => {
  const app = setup(t);
  for (const [path, allow, wrong] of [
    ["/health", "GET, OPTIONS", "POST"],
    ["/v1/metadata", "POST, OPTIONS", "GET"],
    [`/v1/metadata/${"f".repeat(64)}`, "GET, OPTIONS", "POST"],
    [`/v1/images/${"f".repeat(64)}`, "GET, OPTIONS", "DELETE"],
  ]) {
    for (const method of ["HEAD", wrong]) {
      const response = await app.send(path, { method });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("Allow"), allow);
      assert.equal((await response.json<{ code: string }>()).code, "METHOD_NOT_ALLOWED");
    }
  }
  assert.equal(app.bucket.reads.length, 0);
});

test("copies staged images before publishing and refuses promotion when the image is missing", async (t) => {
  let registered = "";
  const app = setup(t, () => ({ tokens: [{ metadata_hash: registered }] }));
  const upload = await app.send("/v1/metadata", { method: "POST", body: form(png()) });
  const { hash, document } = await upload.json<{ hash: string; document: MetadataDocument }>();
  registered = hash;
  app.bucket.objects.delete(`pending-img/${document.image!.sha256}`);
  const response = await app.send(`/v1/metadata/${hash}`);
  assert.equal(response.status, 500);
  assert.equal((await response.json<{ code: string }>()).code, "INTEGRITY_ERROR");
  assert.equal(app.bucket.objects.has(`final/${hash}.json`), false);
  assert.equal(app.bucket.objects.has(`final-img/${document.image!.sha256}`), false);
});

test("positive metadata and image cache hits skip R2 and keep CORS specific to each request", async (t) => {
  let registered = "";
  const app = setup(t, () => ({ tokens: [{ metadata_hash: registered }] }));
  const upload = await app.send("/v1/metadata", { method: "POST", body: form(png()) });
  const { hash, document } = await upload.json<{ hash: string; document: MetadataDocument }>();
  registered = hash;
  for (const path of [`/v1/metadata/${hash}`, `/v1/images/${document.image!.sha256}`]) {
    const first = await app.send(path, { headers: { Origin: "https://wallet.bunkercoin.com" } });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Access-Control-Allow-Origin"), "https://wallet.bunkercoin.com");
    const content = await first.arrayBuffer();
    const reads = app.bucket.reads.length;
    for (const origin of ["https://explorer.bunkercoin.com", "https://evil.test"]) {
      const uppercaseHash = path.replace(/[a-f0-9]{64}$/, (hash) => hash.toUpperCase());
      const cached = await app.send(`${uppercaseHash}?ignored=1`, { headers: { Origin: origin } });
      assert.equal(cached.status, 200);
      assert.deepEqual(await cached.arrayBuffer(), content);
      assert.equal(cached.headers.get("X-Content-Type-Options"), "nosniff");
      assert.equal(cached.headers.get("Access-Control-Allow-Origin"), origin === "https://evil.test" ? null : origin);
    }
    assert.equal(app.bucket.reads.length, reads);
  }
  assert.equal(app.node.mock.callCount(), 1);
});
