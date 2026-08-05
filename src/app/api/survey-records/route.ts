import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSurveyRecordFromOcr } from "../../../domain/build-survey-record-from-ocr";
import { surveyRecordSchema } from "../../../domain/survey-record";
import { surveyParseCandidateSchema } from "../../../services/ocr-parser";
import {
  GoogleSheetsRestClient, GoogleSheetsSurveyRecordPersistence, saveSurveyRecords,
  SurveyRecordPersistenceError,
} from "../../../services/survey-record-persistence";
import { appendCorrectionLog } from "../../../services/survey-masters/correction-log";

const ocrRequestSchema = z.object({
  candidates: z.array(surveyParseCandidateSchema).min(1),
  warningsConfirmed: z.literal(true),
  sourceKind: z.enum(["photo", "screenshot"]).default("photo"),
});

const confirmedRecordsRequestSchema = z.object({
  records: z.array(surveyRecordSchema).min(1),
  sourceText: z.string().max(100_000).default(""),
  operator: z.string().trim().max(200).default(""),
});

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const now = new Date().toISOString();
    const ocrRequest = ocrRequestSchema.safeParse(input);
    const confirmedRequest = confirmedRecordsRequestSchema.safeParse(input);
    if (!ocrRequest.success && !confirmedRequest.success) {
      return NextResponse.json({ error: "保存前の確認内容が不正です。" }, { status: 400 });
    }
    let records;
    let sourceText;
    let operator = "";
    let origin;
    if (ocrRequest.success) {
      records = ocrRequest.data.candidates.map((candidate) => buildSurveyRecordFromOcr(candidate, {
          registeredAt: now, source: ocrRequest.data.sourceKind,
        }));
      sourceText = ocrRequest.data.candidates
        .map((candidate) => candidate.sourceText).filter(Boolean).join("\n---\n");
      origin = "OCR確認画面";
    } else if (confirmedRequest.success) {
      records = confirmedRequest.data.records;
      sourceText = confirmedRequest.data.sourceText;
      operator = confirmedRequest.data.operator;
      origin = "入力画面";
    } else {
      return NextResponse.json({ error: "保存前の確認内容が不正です。" }, { status: 400 });
    }
    const client = GoogleSheetsRestClient.fromEnvironment();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new SurveyRecordPersistenceError(
        "PROVIDER_UNAVAILABLE",
        "Google Sheetsの保存先スプレッドシートIDが設定されていません。",
      );
    }
    const persistence = new GoogleSheetsSurveyRecordPersistence(client, {
      spreadsheetId,
      sheetName: "調査原票",
      operator,
      origin,
      sourceText,
    });
    const saved = await saveSurveyRecords(persistence, records);
    try {
      await appendCorrectionLog(client, spreadsheetId, sourceText, records);
    } catch {
      // Learning data is best-effort and must never block the authoritative save.
    }
    return NextResponse.json({
      ok: true,
      ...saved,
      registeredCount: saved.savedCount,
      registrationIds: saved.recordIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "保存前の確認内容が不正です。" }, { status: 400 });
    const message = error instanceof SurveyRecordPersistenceError ? error.message : "調査データの保存に失敗しました。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
