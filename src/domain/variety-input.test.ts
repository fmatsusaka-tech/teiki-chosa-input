import { describe, expect, it } from "vitest";
import {
  CUSTOM_VARIETY_OPTION,
  resolveVarietyOption,
} from "./variety-input";

describe("resolveVarietyOption", () => {
  const suggestions = ["ゆら早生", "興津早生", "せとか"];

  it("マスタ登録済み品種は該当する選択肢を返す", () => {
    expect(resolveVarietyOption("興津早生", suggestions)).toBe("興津早生");
  });

  it("新品種や未設定値は自由入力を返す", () => {
    expect(resolveVarietyOption("新品種A", suggestions)).toBe(
      CUSTOM_VARIETY_OPTION,
    );
    expect(resolveVarietyOption("未設定", suggestions)).toBe(
      CUSTOM_VARIETY_OPTION,
    );
  });
});
