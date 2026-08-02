export type AnalysisFeedback =
  | { kind: "idle"; message: "" }
  | { kind: "loading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function analysisResultFeedback(recordCount: number): AnalysisFeedback {
  return recordCount > 0
    ? { kind: "success", message: `${recordCount}件を解析しました。内容を確認してください。` }
    : { kind: "error", message: "解析できる調査データが見つかりませんでした。メモの内容を確認してください。" };
}

export function emptyAnalysisFeedback(): AnalysisFeedback {
  return { kind: "error", message: "解析するメモを入力してください。" };
}
