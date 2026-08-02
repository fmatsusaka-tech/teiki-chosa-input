import { describe, expect, it } from "vitest";
import { buildTreatmentSuggestionsByOrchard } from "./survey-treatment-suggestions";

describe("buildTreatmentSuggestionsByOrchard", () => {
  it("列順に依存せず園地別の処理区を空欄除外・重複排除する", () => {
    expect(buildTreatmentSuggestionsByOrchard([
      ["処理区", "登録ID", "園地名"],
      [" マルチ ", "1", " 徳田 "],
      ["マルチ", "2", "徳田"],
      ["無処理区", "3", "徳田"],
      ["スキーム区", "4", "有中"],
      ["", "5", "徳田"],
    ])).toEqual({ 徳田: ["マルチ", "無処理区"], 有中: ["スキーム区"] });
  });

  it("正式見出しがなければ安全に失敗する", () => {
    expect(() => buildTreatmentSuggestionsByOrchard([["園地名"]])).toThrow(
      "調査データの園地名または処理区見出しが不足しています。",
    );
  });

  it("互換見出しの園地でも候補を抽出する", () => {
    expect(buildTreatmentSuggestionsByOrchard([
      ["園地", "処理区"],
      ["徳田", "マルチ"],
    ])).toEqual({ 徳田: ["マルチ"] });
  });
});
