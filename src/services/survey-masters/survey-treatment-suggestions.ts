import type { TreatmentSuggestionsByOrchard } from "../../domain/treatment-input";
import type { GoogleSheetsClient } from "../survey-record-persistence";

export const SURVEY_DATA_SHEET_NAME = "調査データ";

export function buildTreatmentSuggestionsByOrchard(
  rows: readonly (readonly string[])[],
): TreatmentSuggestionsByOrchard {
  const headers = rows[0] ?? [];
  const orchardIndex = headers.indexOf("園地名") >= 0
    ? headers.indexOf("園地名")
    : headers.indexOf("園地");
  const treatmentIndex = headers.indexOf("処理区");
  if (orchardIndex < 0 || treatmentIndex < 0) {
    throw new Error("調査データの園地名または処理区見出しが不足しています。");
  }

  const result: Record<string, string[]> = {};
  rows.slice(1).forEach((row) => {
    const orchard = row[orchardIndex]?.trim() ?? "";
    const treatment = row[treatmentIndex]?.trim() ?? "";
    if (!orchard || !treatment) return;
    const treatments = result[orchard] ?? [];
    if (!treatments.includes(treatment)) treatments.push(treatment);
    result[orchard] = treatments;
  });
  return result;
}

export async function loadTreatmentSuggestionsByOrchard(
  client: GoogleSheetsClient,
  spreadsheetId: string,
): Promise<TreatmentSuggestionsByOrchard> {
  return buildTreatmentSuggestionsByOrchard(
    await client.getRows(spreadsheetId, SURVEY_DATA_SHEET_NAME),
  );
}
