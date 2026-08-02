import { describe, expect, it } from "vitest";
import { analysisResultFeedback, emptyAnalysisFeedback } from "./analysis-feedback";

describe("analysis feedback", () => {
  it("解析件数を成功メッセージで伝える", () => {
    expect(analysisResultFeedback(3)).toEqual({
      kind: "success",
      message: "3件を解析しました。内容を確認してください。",
    });
  });

  it("0件なら入力内容の確認を案内する", () => {
    expect(analysisResultFeedback(0)).toEqual({
      kind: "error",
      message: "解析できる調査データが見つかりませんでした。メモの内容を確認してください。",
    });
  });

  it("空欄ならメモ入力を案内する", () => {
    expect(emptyAnalysisFeedback()).toEqual({
      kind: "error",
      message: "解析するメモを入力してください。",
    });
  });
});
