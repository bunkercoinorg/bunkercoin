# BunkerCoin metadata

Cloudflare Worker and R2 hosting for token metadata. Mint and UpdateMetadata
commit only a 32-byte metadata hash; documents contain no token ID. Uploads stay
pending until the node reports a token with the same hash. Published documents
and their images remain immutable, including after later token metadata updates.

## Endpoints

- `POST /v1/metadata`: multipart fields `name`, `description`, optional file
  `image`. Returns `{hash, document}`; identical uploads return the same hash.
  Ten uploads per rate-limit key per 60 seconds (IPv4 address or IPv6 /64).
  Unknown/duplicate fields are rejected.
- `GET /v1/metadata/<hash>`: serves a published document, or promotes a pending
  document when `NODE_API_URL/tokens` contains its hash. The token lookup is
  cached for 30 seconds; registration can take that long to become visible.
  Pending promotion attempts have a separate limit of 60 per key per 60 seconds.
  Node failures are cached for ten seconds. Scans stop at 20 pages or 10,000
  tokens and return 502 if more scanning would be needed.
- `GET /v1/images/<sha256>`: serves an image referenced by a published document.
- `GET /health`: returns `{"ok":true}`.

Errors are JSON `{error, code}`. CORS allows the configured `ALLOWED_ORIGINS`
with OPTIONS preflight support. HTTP localhost origins require
`ALLOW_LOCALHOST="true"` in `.dev.vars`; the production default is `"false"`.
Documents and published images use a one-year immutable cache policy.
Images are identified from their bytes, never the upload MIME type: PNG or WebP
(VP8, VP8L, VP8X), without APNG or WebP animation, at most 256 KiB, square,
64–512 pixels. Multipart bodies are limited to 272 KiB including fields and
framing. File names are ignored.

## Document and hash

```json
{"v":1,"name":"BunkerCoin","description":"","image":null}
```

Every key is required; additional keys are rejected at both levels. `name` is
1–48 Unicode code points and `description` is 0–280. Strings must already be NFC;
Unicode control characters (Cc) and unpaired UTF-16 surrogates are rejected.
Whitespace inside strings is preserved. An image is `null` or:

```json
{"sha256":"<64 lowercase hex characters>","type":"image/png","width":64,"height":64}
```

`type` can also be `image/webp`. `sha256` hashes the original image bytes.
Dimensions are integers, equal, and in the inclusive 64–512 range.

To compute `metadata_hash`, validate the document, recursively sort object keys
by UTF-16 code unit order (JavaScript `Object.keys(value).sort()`), serialize
each key and primitive with `JSON.stringify` and no whitespace outside strings,
encode as UTF-8 with no BOM or trailing newline, then SHA-256 those bytes.
Use literal Unicode, escape quotes and backslashes, and do not escape `/`.
The top-level order is `description,image,name,v`; the image order is
`height,sha256,type,width`. Return the digest as 64 lowercase hex characters;
the chain commits the corresponding 32 bytes.

Fixed vector (the exact bytes below, without a newline):

```text
{"description":"","image":null,"name":"BunkerCoin","v":1}
```

SHA-256: `3fac357e74836eeb1811034d4c8b7381c54421ab04e73a6134d5cb7fe745d4fb`.

Second fixed vector, including an image object and NFC non-ASCII text (again,
the exact UTF-8 bytes below, without a newline):

```text
{"description":"Épargne / 東京 🪙","image":{"height":64,"sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","type":"image/png","width":64},"name":"Café","v":1}
```

SHA-256: `a3c65791af5a7d5ddbbd5d943c33abb77c1780f71e9417646be087870e7b2407`.

R2 keys are `pending-img/<sha256>`, `img/<sha256>`, `pending/<hash>.json`,
`final/<hash>.json`, and `final-img/<sha256>`. Uploads stage images only under
`pending-img/`. Pending documents include a `created` custom metadata timestamp.
Publication copies the image to `img/` before writing the final document and
then its `final-img/` index; subsequent uncached document reads repair a missing
index after an interrupted write. Positive document and image responses are
stored in the edge Cache API as well as carrying an immutable cache policy.

Wallets should GET `/v1/metadata/<hash>` after the Mint or UpdateMetadata
transaction finalizes so the document and image get promoted. Retry through the
30-second token snapshot cache until it succeeds, and promote before replacing
that hash with a later UpdateMetadata. Pending uploads expire after seven days;
re-upload if needed before finalizing a later transaction.

## One-time setup and deployment

Run from `apps/metadata` with the workspace dependencies installed. Authenticate
Wrangler to the BunkerCoin Cloudflare account and set `CLOUDFLARE_ACCOUNT_ID`
in the environment. The account identifier must stay out of repository files.

```sh
wrangler r2 bucket create bunkercoin-metadata
wrangler r2 bucket lifecycle add bunkercoin-metadata expire-pending pending/ --expire-days 7
wrangler r2 bucket lifecycle add bunkercoin-metadata expire-pending-img pending-img/ --expire-days 7
wrangler r2 bucket lifecycle list bunkercoin-metadata
wrangler deploy
```

Verify both lifecycle rules: `pending/` documents and `pending-img/` images each
expire after seven days. There is no manual garbage collector. Promoted `img/`
objects, `final/` documents and `final-img/` indexes do not expire.
The custom domain is `metadata.bunkercoin.com`; `wrangler.jsonc` configures the
bucket, separate upload/promotion rate limiters, node URL, and production CORS
origins. Workers.dev and preview URLs are disabled. `bun run dev` starts
local development. `bun run typecheck` checks Worker sources and tests;
`bun run test` runs the TypeScript tests directly on Node 24 without compilation.
