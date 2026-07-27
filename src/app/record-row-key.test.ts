import { describe, expect, it } from "vitest";
import { recordRowKey } from "./record-row-key";

describe("recordRowKey", () => {
  it("returns a stable key based only on the fixed row position", () => {
    const beforeEditing = recordRowKey(2);
    const afterEditing = recordRowKey(2);

    expect(afterEditing).toBe(beforeEditing);
    expect(afterEditing).toBe("survey-record-2");
  });

  it("distinguishes separate rows", () => {
    expect(recordRowKey(0)).not.toBe(recordRowKey(1));
  });
});
