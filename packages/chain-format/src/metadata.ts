import { bytesToHex } from './codec.ts';

export type MetadataImage = {
  sha256: string;
  type: 'image/png' | 'image/webp';
  width: number;
  height: number;
};

export type MetadataDocument = {
  v: 1;
  name: string;
  description: string;
  image: MetadataImage | null;
};

export const METADATA_NAME_MAX = 48;
export const METADATA_DESCRIPTION_MAX = 280;
export const METADATA_IMAGE_MIN = 64;
export const METADATA_IMAGE_MAX = 512;

export class MetadataValidationError extends Error {}

const fail = (message: string): never => {
  throw new MetadataValidationError(message);
};

function record(value: unknown, keys: readonly string[], what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(`${what} must be an object`);
  const own = Object.keys(value);
  if (own.length !== keys.length || keys.some((k) => !Object.hasOwn(value, k))) {
    return fail(`${what} must have exactly the keys ${keys.join(', ')}`);
  }
  return value as Record<string, unknown>;
}

// With the u flag a valid pair is one code point, so only unpaired surrogates match.
const LONE_SURROGATE = /[\uD800-\uDFFF]/u;
const CONTROL = /\p{Cc}/u;

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') return fail(`${field} must be a string`);
  if (LONE_SURROGATE.test(value)) fail(`${field} contains an unpaired surrogate`);
  if (CONTROL.test(value)) fail(`${field} contains a control character`);
  if (value.normalize('NFC') !== value) fail(`${field} must be NFC normalized`);
  const length = [...value].length;
  if (length < min || length > max) fail(`${field} must be ${min}-${max} characters`);
  return value;
}

/** The metadata service's document rules; returns a fresh, plain copy. */
export function validateMetadata(value: unknown): MetadataDocument {
  const doc = record(value, ['v', 'name', 'description', 'image'], 'document');
  if (doc.v !== 1) fail('unsupported document version');
  const name = text(doc.name, 'name', 1, METADATA_NAME_MAX);
  const description = text(doc.description, 'description', 0, METADATA_DESCRIPTION_MAX);
  if (doc.image === null) return { v: 1, name, description, image: null };
  const img = record(doc.image, ['sha256', 'type', 'width', 'height'], 'image');
  if (typeof img.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(img.sha256)) fail('image.sha256 must be 64 lowercase hex characters');
  if (img.type !== 'image/png' && img.type !== 'image/webp') fail('image.type must be image/png or image/webp');
  const { width, height } = img;
  if (typeof width !== 'number' || !Number.isInteger(width) || width < METADATA_IMAGE_MIN || width > METADATA_IMAGE_MAX || width !== height) {
    fail(`image must be square, ${METADATA_IMAGE_MIN}-${METADATA_IMAGE_MAX} pixels`);
  }
  return {
    v: 1,
    name,
    description,
    image: { sha256: img.sha256 as string, type: img.type as MetadataImage['type'], width: width as number, height: width as number },
  };
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(',')}}`;
  }
  throw new TypeError('not a metadata JSON value');
}

/** Sorted keys, no whitespace, literal Unicode, `/` unescaped: the exact bytes the chain hash commits to. */
export function canonicalMetadataJson(doc: MetadataDocument): string {
  return canonical(validateMetadata(doc));
}

/** SHA-256 of the canonical UTF-8 bytes, 64 lowercase hex characters. */
export async function metadataHash(doc: MetadataDocument): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalMetadataJson(doc));
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
