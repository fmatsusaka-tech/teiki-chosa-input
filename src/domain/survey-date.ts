import type { SurveyRecord } from "./survey-record";

export function formatLocalSurveyDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function applySurveyDate(
  records: SurveyRecord[],
  surveyDate: string,
): SurveyRecord[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(surveyDate)) return records;

  const measuredAt = `${surveyDate}T00:00:00.000Z`;
  return records.map((record) => ({ ...record, measuredAt }));
}
