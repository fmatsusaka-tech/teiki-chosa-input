import { describe, expect, it } from "vitest";
import { OcrProviderError } from "./ocr-error";
import { ocrUserMessage } from "./user-message";

describe("ocrUserMessage", () => {
  it("explains that text input remains available when OCR is stopped", () => {
    expect(ocrUserMessage(new OcrProviderError({
      code: "PROVIDER_UNAVAILABLE",
      provider: "paddle",
      message: "connection refused",
    }))).toBe("OCR機能は現在利用できません。文章入力と登録は引き続き利用できます。");
  });

  it("does not expose provider-specific failures to users", () => {
    expect(ocrUserMessage(new OcrProviderError({
      code: "PROVIDER_ERROR",
      provider: "paddle",
      message: "private gateway detail",
    }))).not.toContain("private gateway detail");
  });
});