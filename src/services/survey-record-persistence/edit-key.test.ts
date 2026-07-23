import { describe, expect, it } from "vitest";
import { createEditKey, hashEditKey } from "./edit-key";

describe("edit key", () => {
  it("creates independent URL-safe secrets", () => {
    const first = createEditKey();
    const second = createEditKey();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes deterministically without retaining plaintext", () => {
    const hash = hashEditKey("secret");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashEditKey("secret"));
    expect(hash).not.toContain("secret");
  });
});
