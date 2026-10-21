import {
  hexToBytes,
  metadataHash,
  METADATA_DESCRIPTION_MAX,
  METADATA_NAME_MAX,
  validateMetadata,
  type MetadataDocument,
} from '@bunkercoin/chain-format';

export type { MetadataDocument, MetadataImage } from '@bunkercoin/chain-format';
export { metadataHash, validateMetadata, METADATA_NAME_MAX, METADATA_DESCRIPTION_MAX };

/** null until a metadata service is configured; every network call below is then a no-op. */
export const METADATA_URL: string | null = process.env.NEXT_PUBLIC_METADATA_URL?.trim().replace(/\/+$/, '') || null;
export const METADATA_ENABLED = METADATA_URL !== null;

export const ICON_SIZE = 256;
export const MAX_IMAGE_BYTES = 256 * 1024;

const COPY = {
  'unsupported-image': 'Use a PNG, WebP or JPEG image.',
  'unreadable-image': "That image can't be read.",
  'image-too-large': 'That image is too detailed to fit 256 KiB. Try a simpler one.',
  invalid: 'Name 1-48 characters, description up to 280, no control characters.',
  'rate-limited': 'Too many uploads. Retry in a minute.',
  'upload-too-large': 'Upload too large. Use a smaller image.',
  'not-allowed': 'The metadata service refused this site.',
  unavailable: 'Metadata service unavailable. Retry, or create without metadata.',
  mismatch: "The metadata service returned a document that doesn't match. Nothing was signed.",
  disabled: 'Token metadata is not available on this network yet.',
} as const;

export type MetadataErrorCode = keyof typeof COPY;

export class MetadataError extends Error {
  code: MetadataErrorCode;
  constructor(code: MetadataErrorCode) {
    super(COPY[code]);
    this.name = 'MetadataError';
    this.code = code;
  }
}

const SERVICE_CODES: Record<string, MetadataErrorCode> = {
  RATE_LIMITED: 'rate-limited',
  IMAGE_TOO_LARGE: 'image-too-large',
  UPLOAD_TOO_LARGE: 'upload-too-large',
  INVALID_METADATA: 'invalid',
  INVALID_CONTENT_TYPE: 'invalid',
  ORIGIN_NOT_ALLOWED: 'not-allowed',
};

/** The service rejects non-NFC text; the wallet normalizes what the user typed instead. */
export function localDocument(name: string, description: string): MetadataDocument {
  return { v: 1, name: name.normalize('NFC'), description: description.normalize('NFC'), image: null };
}

/** null when name/description would be accepted, else the copy to show. */
export function metadataTextProblem(name: string, description: string): string | null {
  try {
    validateMetadata(localDocument(name, description));
    return null;
  } catch {
    return COPY.invalid;
  }
}

export function metadataHashBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('metadata hash must be 64 lowercase hex characters');
  return hexToBytes(hex)!;
}

export function metadataImageUrl(sha256: string): string {
  if (!METADATA_URL) throw new MetadataError('disabled');
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('image hash must be 64 lowercase hex characters');
  return `${METADATA_URL}/v1/images/${sha256}`;
}

/** Largest centred square of a width x height image. */
export function squareCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}

const WEBP_QUALITIES = [0.92, 0.8, 0.65, 0.5];

/** PNG first; WebP at falling quality only when PNG reaches 256 KiB. Encoders that ignore WebP return PNG, which is skipped. */
export async function encodeIcon(
  encode: (type: 'image/png' | 'image/webp', quality?: number) => Promise<Blob | null>,
): Promise<{ blob: Blob; type: 'image/png' | 'image/webp' }> {
  const png = await encode('image/png');
  if (png && png.type === 'image/png' && png.size < MAX_IMAGE_BYTES) return { blob: png, type: 'image/png' };
  for (const q of WEBP_QUALITIES) {
    const webp = await encode('image/webp', q);
    if (!webp || webp.type !== 'image/webp') break;
    if (webp.size < MAX_IMAGE_BYTES) return { blob: webp, type: 'image/webp' };
  }
  throw new MetadataError('image-too-large');
}

const ACCEPTED = new Set(['image/png', 'image/webp', 'image/jpeg']);

export async function prepareIcon(file: File): Promise<{ blob: Blob; type: 'image/png' | 'image/webp'; size: 256 }> {
  if (!ACCEPTED.has(file.type)) throw new MetadataError('unsupported-image');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new MetadataError('unreadable-image');
  }
  try {
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
    if (side < 1) throw new MetadataError('unreadable-image');
    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new MetadataError('unreadable-image');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, ICON_SIZE, ICON_SIZE);
    const out = await encodeIcon((type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality)));
    return { ...out, size: ICON_SIZE };
  } finally {
    bitmap.close();
  }
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/**
 * Uploads a pending document and verifies the reply locally: the hash is recomputed, the text must be
 * what was sent and the image must be these bytes. AbortError propagates unchanged.
 */
export async function uploadMetadata(
  input: { name: string; description: string; image?: Blob },
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<{ hash: string; document: MetadataDocument }> {
  if (!METADATA_URL) throw new MetadataError('disabled');
  const local = localDocument(input.name, input.description);
  if (metadataTextProblem(local.name, local.description)) throw new MetadataError('invalid');
  if (input.image && input.image.size >= MAX_IMAGE_BYTES) throw new MetadataError('image-too-large');
  const form = new FormData();
  form.set('name', local.name);
  form.set('description', local.description);
  if (input.image) form.set('image', input.image, 'icon');
  let res: Response;
  try {
    res = await fetchImpl(`${METADATA_URL}/v1/metadata`, { method: 'POST', body: form, signal, credentials: 'omit' });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new MetadataError('unavailable');
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new MetadataError(res.ok ? 'mismatch' : 'unavailable');
  }
  if (!res.ok) {
    const code = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined;
    throw new MetadataError((typeof code === 'string' && SERVICE_CODES[code]) || 'unavailable');
  }
  const { hash, document } = (typeof body === 'object' && body !== null ? body : {}) as { hash?: unknown; document?: unknown };
  let doc: MetadataDocument;
  try {
    doc = validateMetadata(document);
  } catch {
    throw new MetadataError('mismatch');
  }
  const expectedImage = input.image ? await sha256Hex(input.image) : null;
  if (
    typeof hash !== 'string' ||
    hash !== (await metadataHash(doc)) ||
    doc.name !== local.name ||
    doc.description !== local.description ||
    (doc.image?.sha256 ?? null) !== expectedImage
  ) {
    throw new MetadataError('mismatch');
  }
  return { hash, document: doc };
}

const cache = new Map<string, Promise<MetadataDocument | null>>();

async function fetchDocument(hash: string, signal: AbortSignal | undefined, fetchImpl: typeof fetch): Promise<MetadataDocument | null> {
  if (!METADATA_URL) return null;
  const res = await fetchImpl(`${METADATA_URL}/v1/metadata/${hash}`, { signal, credentials: 'omit' });
  if (!res.ok) return null;
  const doc = validateMetadata(JSON.parse(await res.text()));
  return (await metadataHash(doc)) === hash ? doc : null;
}

/** A published document whose canonical hash is `hash`, or null on any failure. Verified results are cached. */
export async function fetchVerifiedMetadata(
  hash: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<MetadataDocument | null> {
  if (!METADATA_URL || !/^[0-9a-f]{64}$/.test(hash)) return null;
  const hit = cache.get(hash);
  if (hit) return hit;
  const pending = fetchDocument(hash, signal, fetchImpl).catch(() => null);
  cache.set(hash, pending);
  const doc = await pending;
  // Only verified documents stay cached; misses (pending, offline, aborted) are retried next time.
  if (!doc && cache.get(hash) === pending) cache.delete(hash);
  return doc;
}

/** After the token is final, one GET makes the service publish the pending document. */
export async function promoteMetadata(hash: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!METADATA_URL || !/^[0-9a-f]{64}$/.test(hash)) return;
  cache.delete(hash);
  await fetchVerifiedMetadata(hash, undefined, fetchImpl);
}

export function clearMetadataCache(): void {
  cache.clear();
}
