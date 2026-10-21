export interface MetadataImage {
  sha256: string;
  type: "image/png" | "image/webp";
  width: number;
  height: number;
}

export interface MetadataDocument {
  v: 1;
  name: string;
  description: string;
  image: MetadataImage | null;
}

export class ValidationError extends Error {}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Expected an object");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) {
    throw new ValidationError("Missing or unknown document keys");
  }
  return record;
}

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string`);
  const length = [...value].length;
  if (length < min || length > max) throw new ValidationError(`${field} must contain ${min}-${max} characters`);
  if (/\p{Cc}/u.test(value) || /[\uD800-\uDFFF]/u.test(value)) {
    throw new ValidationError(`${field} contains control characters or unpaired surrogates`);
  }
  if (value.normalize("NFC") !== value) throw new ValidationError(`${field} must be NFC normalized`);
  return value;
}

export function validateDocument(value: unknown): MetadataDocument {
  const doc = object(value, ["v", "name", "description", "image"]);
  if (doc.v !== 1) throw new ValidationError("Unsupported document version");
  const name = text(doc.name, "name", 1, 48);
  const description = text(doc.description, "description", 0, 280);
  let image: MetadataImage | null = null;
  if (doc.image !== null) {
    const input = object(doc.image, ["sha256", "type", "width", "height"]);
    if (typeof input.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.sha256)) {
      throw new ValidationError("image.sha256 must be 64 lowercase hex characters");
    }
    if (input.type !== "image/png" && input.type !== "image/webp") {
      throw new ValidationError("Unsupported image type");
    }
    if (typeof input.width !== "number" || !Number.isInteger(input.width) ||
        input.width < 64 || input.width > 512 || input.width !== input.height) {
      throw new ValidationError("Image must be square and 64-512 pixels");
    }
    image = { sha256: input.sha256, type: input.type, width: input.width, height: input.width };
  }
  return { v: 1, name, description, image };
}
