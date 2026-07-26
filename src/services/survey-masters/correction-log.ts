import type { SurveyRecord } from "../../domain/survey-record";
import type { GoogleSheetsClient } from "../survey-record-persistence";

export const CORRECTION_LOG_SHEET_NAME = "解析補正ログ";
export const CORRECTION_LOG_HEADERS = [
  "記録日時",
  "原文メモ",
  "園地名",
  "品種",
  "処理区",
  "備考",
  "横径",
  "糖度",
  "酸度",
  "入力方法",
] as const;

export async function appendCorrectionLog(
  client: GoogleSheetsClient,
  spreadsheetId: string,
  sourceText: string,
  records: readonly SurveyRecord[],
  now = new Date(),
): Promise<void> {
  if (!sourceText.trim() || records.length === 0) return;
  const headers = await client.getHeaderRow(spreadsheetId, CORRECTION_LOG_SHEET_NAME);
  if (CORRECTION_LOG_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new Error("解析補正ログの見出しが一致しません。");
  }
  const timestamp = now.toISOString();
  await client.appendRows({
    spreadsheetId,
    sheetName: CORRECTION_LOG_SHEET_NAME,
    rows: records.map((record) => [
      timestamp,
      sourceText,
      record.orchard,
      record.variety,
      record.treatment ?? "",
      record.notes,
      record.diametersMm.join(","),
      record.brix ?? "",
      record.acidity ?? "",
      record.source,
    ]),
  });
}
