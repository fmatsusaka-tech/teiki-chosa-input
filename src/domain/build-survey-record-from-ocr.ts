import type { SurveyParseCandidate } from "../services/ocr-parser";
import { surveyRecordSchema, type SurveyRecord } from "./survey-record";

export function buildSurveyRecordFromOcr(
  candidate: SurveyParseCandidate,
  options: { registeredAt: string; source: "photo" | "screenshot" },
): SurveyRecord {
  const warnings = candidate.warnings.map((warning) => warning.message);
  // Missing dates default to the registration time, matching the text-input parser
  // (parseSurveyMemo) and SPECIFICATION.md 5.3, instead of failing schema validation.
  const measuredAt = candidate.measuredDate
    ? new Date(`${candidate.measuredDate}T00:00:00.000Z`).toISOString()
    : (() => {
        warnings.push("計測日がなかったため登録日を仮設定しました");
        return options.registeredAt;
      })();

  return surveyRecordSchema.parse({
    measuredAt,
    registeredAt: options.registeredAt,
    orchard: candidate.orchard ?? "",
    variety: candidate.variety ?? "",
    treatment: candidate.treatment,
    diametersMm: candidate.diametersMm ?? [],
    brix: candidate.brix,
    acidity: candidate.acidity,
    notes: candidate.notes ?? "",
    source: options.source,
    confidence: candidate.confidence,
    warnings,
  });
}
