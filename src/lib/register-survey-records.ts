import type { SurveyRecord } from "../domain/survey-record";

export type RegistrationResult = {
  ok: boolean;
  registeredCount?: number;
  skippedCount?: number;
  skippedIds?: string[];
  message?: string;
  error?: string;
};

export async function registerSurveyRecords(
  records: SurveyRecord[],
  sourceText: string,
  operator = "",
): Promise<RegistrationResult> {
  const payload = {
    records,
    operator,
    sourceText,
  };

  const response = await fetch("/api/survey-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`登録通信に失敗しました（${response.status}）。`);
  }

  const result = (await response.json()) as RegistrationResult;
  if (!result.ok) throw new Error(result.message || result.error || "登録に失敗しました。");
  return result;
}
