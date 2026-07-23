import { describe, expect, it } from "vitest";
import { MAX_OCR_IMAGE_BYTES, validateOcrImage } from "./image-input-validation";

describe("OCR image input validation", () => {
  it("accepts supported images up to 10MB", () => {
    expect(validateOcrImage({ type: "image/jpeg", size: MAX_OCR_IMAGE_BYTES })).toEqual({ valid: true });
    expect(validateOcrImage({ type: "image/png", size: 1 })).toEqual({ valid: true });
  });

  it("rejects unsupported formats and oversized images", () => {
    expect(validateOcrImage({ type: "image/gif", size: 1 })).toMatchObject({ valid: false, status: 400 });
    expect(validateOcrImage({ type: "image/jpeg", size: MAX_OCR_IMAGE_BYTES + 1 }))
      .toMatchObject({ valid: false, status: 413 });
  });
});
