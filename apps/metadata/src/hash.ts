import { canonicalBytes } from "./canonical.ts";
import { validateDocument } from "./validate.ts";

export async function sha256(value: Uint8Array | string): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function metadataHash(document: unknown): Promise<string> {
  return sha256(canonicalBytes(validateDocument(document)));
}
