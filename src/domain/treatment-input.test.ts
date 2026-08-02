import { describe, expect, it } from "vitest";
import {
  CUSTOM_TREATMENT_OPTION,
  resolveTreatmentOption,
  treatmentSuggestionsForOrchard,
} from "./treatment-input";

describe("treatmentSuggestionsForOrchard", () => {
  const suggestions = {
    徳田: ["無処理区", "マルチ"],
    有中: ["スキーム区"],
  };

  it("園地名の前後空白を除いて一致する候補だけを返す", () => {
    expect(treatmentSuggestionsForOrchard(" 徳田 ", suggestions)).toEqual([
      "無処理区",
      "マルチ",
    ]);
  });

  it("過去候補とフォールバック候補を空欄除外・重複排除する", () => {
    expect(treatmentSuggestionsForOrchard("徳田", suggestions, ["マルチ", "慣行", ""])).toEqual([
      "無処理区",
      "マルチ",
      "慣行",
    ]);
  });

  it("園地不一致では別園地の候補を混在させない", () => {
    expect(treatmentSuggestionsForOrchard("未登録園地", suggestions)).toEqual([]);
  });
});

describe("resolveTreatmentOption", () => {
  it("候補内の値を選択し、候補外・空欄は自由記入扱いにする", () => {
    expect(resolveTreatmentOption("マルチ", ["マルチ"])).toBe("マルチ");
    expect(resolveTreatmentOption("新処理", ["マルチ"])).toBe(CUSTOM_TREATMENT_OPTION);
    expect(resolveTreatmentOption(null, ["マルチ"])).toBe(CUSTOM_TREATMENT_OPTION);
  });
});
