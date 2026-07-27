import type { SurveyParseCandidate } from "../../services/ocr-parser";

export type ReviewFieldErrors = Partial<
  Record<"measuredDate" | "orchard" | "variety" | "diametersMm" | "brix", string>
>;

export function validateReviewCandidate(candidate: SurveyParseCandidate): ReviewFieldErrors {
  return {
    ...(candidate.measuredDate ? {} : { measuredDate: "調査日を入力してください" }),
    ...(candidate.orchard?.trim() ? {} : { orchard: "園地を選択してください" }),
    ...(candidate.variety?.trim() ? {} : { variety: "品種を選択してください" }),
    ...(candidate.diametersMm?.length
      ? candidate.diametersMm.length <= 10
        ? {}
        : { diametersMm: "横径は10個以内にしてください" }
      : { diametersMm: "横径を1個以上入力してください" }),
    ...(candidate.brix === null ? { brix: "糖度を入力してください" } : {}),
  };
}

export function parseOptionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseOptionalDiameters(values: readonly string[]): number[] | null {
  const parsed = values
    .filter((value) => value.trim() !== "")
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  return parsed.length > 0 ? parsed : null;
}
