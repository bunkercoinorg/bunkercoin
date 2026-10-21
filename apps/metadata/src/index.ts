import { canonicalize } from "./canonical.ts";
import { metadataHash, sha256 } from "./hash.ts";
import { inspectImage, MAX_IMAGE_BYTES } from "./image.ts";
import { validateDocument, ValidationError } from "./validate.ts";
import type { MetadataDocument } from "./validate.ts";

export interface Env {
  METADATA: R2Bucket;
  UPLOAD_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
  PROMOTE_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
  NODE_API_URL: string;
  ALLOWED_ORIGINS: string;
  ALLOW_LOCALHOST?: string;
}

const IMMUTABLE = "public, max-age=31536000, immutable";
const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES + 16 * 1024;

class HttpError extends Error {
  status: number;
  code: string;
  headers?: HeadersInit;

  constructor(status: number, code: string, message: string, headers?: HeadersInit) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  const response = new Response(JSON.stringify(value), { status, headers });
  response.headers.set("Content-Type", "application/json; charset=utf-8");
  return response;
}

function allowedOrigin(origin: string, env: Env): boolean {
  if (env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).includes(origin)) return true;
  if (env.ALLOW_LOCALHOST !== "true" || !/^http:\/\/localhost(?::\d{1,5})?$/.test(origin)) return false;
  try {
    return new URL(origin).hostname === "localhost";
  } catch {
    return false;
  }
}

function cors(response: Response, origin: string | null, env: Env): Response {
  response.headers.set("Vary", "Origin");
  if (origin && allowedOrigin(origin, env)) response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
}

function rateLimitKey(request: Request): string {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  if (!ip.includes(":")) return ip;
  // Expand compressed IPv6 (including dotted IPv4 tails) before taking the /64.
  const address = ip.toLowerCase().replace(/\d+\.\d+\.\d+\.\d+$/, (tail) => {
    const octets = tail.split(".").map(Number);
    return `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  });
  const [left, right] = address.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const hextets = right === undefined ? start : [...start, ...Array(8 - start.length - end.length).fill("0"), ...end];
  return `${hextets.slice(0, 4).map((part) => parseInt(part, 16).toString(16)).join(":")}::/64`;
}

async function enforceLimit(request: Request, limiter: Env["UPLOAD_LIMIT"]): Promise<void> {
  if (!(await limiter.limit({ key: rateLimitKey(request) })).success) {
    throw new HttpError(429, "RATE_LIMITED", "Rate limit exceeded", { "Retry-After": "60" });
  }
}

async function uploadForm(request: Request): Promise<FormData> {
  const type = request.headers.get("Content-Type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(type)) {
    throw new HttpError(415, "INVALID_CONTENT_TYPE", "Expected multipart/form-data");
  }
  const declaredSize = request.headers.get("Content-Length");
  if (declaredSize && Number(declaredSize) > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, "UPLOAD_TOO_LARGE", "Upload exceeds the multipart size limit");
  }
  if (!request.body) throw new ValidationError("Missing multipart body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "UPLOAD_TOO_LARGE", "Upload exceeds the multipart size limit");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Response(bytes, { headers: { "Content-Type": type } }).formData();
  } catch {
    throw new ValidationError("Malformed multipart body");
  }
}

async function upload(request: Request, env: Env): Promise<Response> {
  await enforceLimit(request, env.UPLOAD_LIMIT);
  const form = await uploadForm(request);
  const seen = new Set<string>();
  for (const [key] of form) {
    if (!["name", "description", "image"].includes(key) || seen.has(key)) {
      throw new ValidationError("Unknown or duplicate multipart field");
    }
    seen.add(key);
  }
  let image: MetadataDocument["image"] = null;
  let imageBytes: Uint8Array | undefined;
  const file = form.get("image");
  if (file !== null && !(typeof file !== "string" && file.size === 0 && file.name === "")) {
    if (typeof file === "string") throw new ValidationError("image must be a file");
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, "IMAGE_TOO_LARGE", "Image exceeds 256 KiB");
    imageBytes = new Uint8Array(await file.arrayBuffer());
    image = { ...inspectImage(imageBytes), sha256: await sha256(imageBytes) };
  }
  const document = validateDocument({ v: 1, name: form.get("name"), description: form.get("description"), image });
  const hash = await metadataHash(document);
  if (image && imageBytes && !(await env.METADATA.head(`img/${image.sha256}`)) &&
      !(await env.METADATA.head(`pending-img/${image.sha256}`))) {
    await env.METADATA.put(`pending-img/${image.sha256}`, imageBytes, { httpMetadata: { contentType: image.type } });
  }
  if (!(await env.METADATA.head(`final/${hash}.json`)) && !(await env.METADATA.head(`pending/${hash}.json`))) {
    await env.METADATA.put(`pending/${hash}.json`, canonicalize(document), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: { created: new Date().toISOString() },
    });
  }
  return json({ hash, document });
}

interface TokenPage {
  tokens: { metadata_hash: string }[];
  next_offset?: number;
  total?: number;
  has_more?: boolean;
  limit?: number;
}

type TokenList = TokenPage | TokenPage["tokens"];
const MAX_TOKEN_PAGES = 20;
const MAX_TOKENS = 10_000;

function validateTokenList(value: unknown): TokenList {
  const page = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
  const tokens = Array.isArray(value) ? value : page?.tokens;
  if (!Array.isArray(tokens) || tokens.length > MAX_TOKENS || tokens.some((token: unknown) =>
    !token || typeof token !== "object" || Array.isArray(token) || !("metadata_hash" in token) ||
    typeof token.metadata_hash !== "string" || !/^[a-fA-F0-9]{64}$/.test(token.metadata_hash))) {
    throw new HttpError(502, "NODE_UNAVAILABLE", "Invalid token list");
  }
  for (const field of ["next_offset", "total", "limit", "offset"] as const) {
    const number = page?.[field];
    if (number !== undefined && (typeof number !== "number" || !Number.isSafeInteger(number) ||
        number < (field === "limit" ? 1 : 0))) {
      throw new HttpError(502, "NODE_UNAVAILABLE", "Invalid token pagination");
    }
  }
  if (page?.has_more !== undefined && typeof page.has_more !== "boolean") {
    throw new HttpError(502, "NODE_UNAVAILABLE", "Invalid token pagination");
  }
  return value as TokenList;
}

async function tokenPage(url: URL, ctx: ExecutionContext): Promise<TokenList> {
  const cacheUrl = new URL("https://metadata.bunkercoin.com/__cache/tokens");
  cacheUrl.searchParams.set("source", url.toString());
  const key = new Request(cacheUrl);
  const cached = await caches.default.match(key);
  if (cached) {
    if (!cached.ok) throw new HttpError(502, "NODE_UNAVAILABLE", "Token lookup failed");
    return validateTokenList(await cached.json());
  }
  let body: TokenList;
  try {
    const response = await fetch(new Request(url), {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Token lookup failed");
    body = validateTokenList(await response.json());
  } catch {
    // Only internal lookup failures are cached; errors sent to callers stay no-store.
    ctx.waitUntil(caches.default.put(key, json({ code: "NODE_UNAVAILABLE" }, 502,
      { "Cache-Control": "public, max-age=10" })));
    throw new HttpError(502, "NODE_UNAVAILABLE", "Token lookup failed");
  }
  ctx.waitUntil(caches.default.put(key, json(body, 200, { "Cache-Control": "public, max-age=30" })));
  return body;
}

async function isRegistered(hash: string, env: Env, ctx: ExecutionContext): Promise<boolean> {
  const url = new URL(`${env.NODE_API_URL.replace(/\/+$/, "")}/tokens`);
  const pageSize = 100;
  const seen = new Set<string>();
  let offset = 0;
  let count = 0;
  for (let pageNumber = 0; pageNumber < MAX_TOKEN_PAGES; pageNumber++) {
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    const value = await tokenPage(url, ctx);
    const page = Array.isArray(value) ? null : value;
    const tokens = Array.isArray(value) ? value : value.tokens;
    count += tokens.length;
    if (count > MAX_TOKENS) throw new HttpError(502, "NODE_UNAVAILABLE", "Token lookup limit exceeded");
    if (tokens.some((token) => token.metadata_hash.toLowerCase() === hash)) return true;
    if (tokens.length === 0) return false;
    const fingerprint = JSON.stringify(tokens);
    if (seen.has(fingerprint)) throw new HttpError(502, "NODE_UNAVAILABLE", "Token pagination did not advance");
    seen.add(fingerprint);

    const next = offset + tokens.length;
    if (page?.next_offset !== undefined && page.next_offset > offset) {
      offset = page.next_offset;
    } else if (page?.total !== undefined && next < page.total) {
      offset = next;
    } else if (page?.has_more === true || (Array.isArray(value) && tokens.length === pageSize) ||
        (page?.limit !== undefined && tokens.length === page.limit && page.has_more !== false &&
          (page.total === undefined || next < page.total))) {
      offset = next;
    } else {
      return false;
    }
    if (count === MAX_TOKENS) throw new HttpError(502, "NODE_UNAVAILABLE", "Token lookup limit exceeded");
  }
  throw new HttpError(502, "NODE_UNAVAILABLE", "Token lookup limit exceeded");
}

async function promoteImage(document: MetadataDocument, env: Env): Promise<void> {
  if (!document.image || await env.METADATA.head(`img/${document.image.sha256}`)) return;
  const staged = await env.METADATA.get(`pending-img/${document.image.sha256}`);
  if (!staged) throw new HttpError(500, "INTEGRITY_ERROR", "Stored image missing");
  await env.METADATA.put(`img/${document.image.sha256}`, staged.body, {
    httpMetadata: { contentType: document.image.type },
  });
}

async function imageIndex(document: MetadataDocument, hash: string, env: Env): Promise<void> {
  if (document.image && !(await env.METADATA.head(`final-img/${document.image.sha256}`))) {
    await env.METADATA.put(`final-img/${document.image.sha256}`, hash);
  }
}

async function metadata(hash: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const finalKey = `final/${hash}.json`;
  const final = await env.METADATA.get(finalKey);
  const stored = final ?? await env.METADATA.get(`pending/${hash}.json`);
  if (!stored) throw new HttpError(404, "NOT_FOUND", "Metadata not found");
  if (!final) await enforceLimit(request, env.PROMOTE_LIMIT);
  let document: MetadataDocument;
  try {
    document = validateDocument(await stored.json());
  } catch {
    throw new HttpError(500, "INTEGRITY_ERROR", "Invalid stored metadata");
  }
  if (await metadataHash(document) !== hash) throw new HttpError(500, "INTEGRITY_ERROR", "Stored metadata hash mismatch");
  if (!final && !(await isRegistered(hash, env, ctx))) {
    throw new HttpError(404, "NOT_FOUND", "Metadata not found");
  }
  const body = canonicalize(document);
  await promoteImage(document, env);
  if (!final) {
    await env.METADATA.put(finalKey, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: stored.customMetadata,
    });
  }
  await imageIndex(document, hash, env);
  return new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": IMMUTABLE },
  });
}

async function image(hash: string, env: Env): Promise<Response> {
  if (!(await env.METADATA.head(`final-img/${hash}`))) throw new HttpError(404, "NOT_FOUND", "Image not found");
  const object = await env.METADATA.get(`img/${hash}`);
  if (!object) throw new HttpError(404, "NOT_FOUND", "Image not found");
  const type = object.httpMetadata?.contentType;
  if (type !== "image/png" && type !== "image/webp") {
    throw new HttpError(500, "INTEGRITY_ERROR", "Invalid stored image type");
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": IMMUTABLE,
    },
  });
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    if (!origin || !allowedOrigin(origin, env)) throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed");
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    } });
  }
  const path = new URL(request.url).pathname;
  if (path === "/health") {
    if (request.method !== "GET") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed", { Allow: "GET, OPTIONS" });
    return json({ ok: true });
  }
  if (path === "/v1/metadata") {
    if (request.method !== "POST") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed", { Allow: "POST, OPTIONS" });
    if (origin && !allowedOrigin(origin, env)) throw new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed");
    return upload(request, env);
  }
  const match = /^\/v1\/(metadata|images)\/([a-fA-F0-9]{64})$/.exec(path);
  if (match) {
    if (request.method !== "GET") throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method not allowed", { Allow: "GET, OPTIONS" });
    const hash = match[2].toLowerCase();
    const key = new Request(`https://metadata.bunkercoin.com/v1/${match[1]}/${hash}`);
    const cached = await caches.default.match(key);
    if (cached) return new Response(cached.body, cached);
    const response = match[1] === "metadata" ? await metadata(hash, request, env, ctx) : await image(hash, env);
    ctx.waitUntil(caches.default.put(key, response.clone()));
    return response;
  }
  throw new HttpError(404, "NOT_FOUND", "Route not found");
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let response: Response;
    try {
      response = await route(request, env, ctx);
    } catch (error) {
      if (error instanceof HttpError) response = json({ error: error.message, code: error.code }, error.status, error.headers);
      else if (error instanceof ValidationError) response = json({ error: error.message, code: "INVALID_METADATA" }, 400);
      else response = json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
    }
    if (response.status >= 400) response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    if (response.headers.get("Content-Type")?.startsWith("application/json")) {
      response.headers.set("Content-Security-Policy", "default-src 'none'");
    }
    return cors(response, request.headers.get("Origin"), env);
  },
} satisfies ExportedHandler<Env>;
