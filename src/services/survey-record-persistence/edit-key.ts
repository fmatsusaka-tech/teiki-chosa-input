import { createHash, randomBytes } from "node:crypto";

/** Generate a URL-safe secret with 256 bits of entropy. */
export function createEditKey(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this one-way representation may be persisted. */
export function hashEditKey(editKey: string): string {
  return createHash("sha256").update(editKey, "utf8").digest("hex");
}
