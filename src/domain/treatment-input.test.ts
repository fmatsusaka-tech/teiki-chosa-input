import { describe, expect, it } from "vitest";
import {
  CUSTOM_TREATMENT_OPTION,
  resolveTreatmentOption,
} from "./treatment-input";

describe("resolveTreatmentOption", () => {
  const suggestions = ["無処理区", "スキー", "ミヨビ"];

  it("マスタ登録済み処理区は該当する選択肢を返す", () => {
    expect(resolveTreatmentOption("スキー", suggestions)).toBe("スキー");
  });

  it("未登録の処理区は自由入力を返す", () => {
    expect(resolveTreatmentOption("フィガロン区", suggestions)).toBe(
      CUSTOM_TREATMENT_OPTION,
    );
  });

  it("未選択（null・未入力）は空文字を返す", () => {
    expect(resolveTreatmentOption(null, suggestions)).toBe("");
    expect(resolveTreatmentOption(undefined, suggestions)).toBe("");
    expect(resolveTreatmentOption("", suggestions)).toBe("");
  });
});
