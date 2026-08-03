import type { SurveyRecord } from "../../domain/survey-record";
import type { GoogleSheetsClient } from "./google-sheets-client";
import { createEditKey, hashEditKey } from "./edit-key";
import { SurveyRecordPersistenceError } from "./persistence-error";
import type { SaveSurveyRecordsResult, SurveyRecordPersistence } from "./persistence-types";

export const DEFAULT_SURVEY_SPREADSHEET_ID = "1Ix7qFigeUvmxkEl3C51rmzuBzYDq7OR_ZGHq6GUKa0g";
export const DEFAULT_SURVEY_RAW_SHEET_NAME = "調査原票";

export const SURVEY_RAW_HEADERS = [
  "登録ID", "編集キーハッシュ", "登録日時", "更新日時", "改訂番号", "データ状態",
  "計測日", "園地名", "品種", "処理区", "備考",
  "横径1", "横径2", "横径3", "横径4", "横径5", "横径6", "横径7", "横径8", "横径9", "横径10",
  "糖度", "酸度", "入力方法", "入力者", "送信元", "原文メモ",
] as const;

type RawHeader = typeof SURVEY_RAW_HEADERS[number];
type CellValue = string | number;

export type GoogleSheetsSurveyRecordPersistenceOptions = {
  spreadsheetId?: string;
  sheetName?: string;
  operator?: string;
  origin?: string;
  sourceText?: string;
  createId?: () => string;
  createEditKey?: () => string;
  hashEditKey?: (editKey: string) => string;
  now?: () => Date;
};

function missingCell(value: number | null | undefined): CellValue {
  return value ?? "";
}

/**
 * Google Sheetsが日付として認識できる "yyyy/MM/dd HH:mm:ss"（日本時間）へ変換する。
 * ISO 8601文字列（"T"区切り・"Z"付き）をそのまま書き込むと、Sheets側は日付として
 * 解釈できず生の文字列表示になってしまうため。
 */
export function formatSheetDateTime(iso: string): string {
  const date = new Date(iso);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())} `
    + `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}`;
}

function recordCells(
  record: SurveyRecord,
  id: string,
  editKeyHash: string,
  registeredAt: string,
  options: GoogleSheetsSurveyRecordPersistenceOptions,
): Record<RawHeader, CellValue> {
  const diameters = Array.from({ length: 10 }, (_, index) => missingCell(record.diametersMm[index]));
  const registeredAtCell = formatSheetDateTime(registeredAt);
  return {
    登録ID: id,
    編集キーハッシュ: editKeyHash,
    登録日時: registeredAtCell,
    更新日時: registeredAtCell,
    改訂番号: 1,
    データ状態: "有効",
    計測日: formatSheetDateTime(record.measuredAt),
    園地名: record.orchard,
    品種: record.variety,
    処理区: record.treatment ?? "",
    備考: record.notes,
    横径1: diameters[0], 横径2: diameters[1], 横径3: diameters[2], 横径4: diameters[3], 横径5: diameters[4],
    横径6: diameters[5], 横径7: diameters[6], 横径8: diameters[7], 横径9: diameters[8], 横径10: diameters[9],
    糖度: missingCell(record.brix),
    酸度: missingCell(record.acidity),
    入力方法: record.source,
    入力者: options.operator ?? "",
    送信元: options.origin ?? "",
    原文メモ: options.sourceText ?? "",
  };
}

function resolveColumns(headers: readonly string[]): RawHeader[] {
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  const missing = SURVEY_RAW_HEADERS.filter((header) => !headers.includes(header));
  if (duplicates.length > 0 || missing.length > 0) {
    const details = [
      missing.length > 0 ? `不足: ${missing.join(", ")}` : "",
      duplicates.length > 0 ? `重複: ${[...new Set(duplicates)].join(", ")}` : "",
    ].filter(Boolean).join(" / ");
    throw new SurveyRecordPersistenceError(
      "PROVIDER_ERROR",
      `調査原票の見出しが保存仕様と一致しません（${details}）。`,
    );
  }
  return headers as RawHeader[];
}

export class GoogleSheetsSurveyRecordPersistence implements SurveyRecordPersistence {
  private readonly spreadsheetId: string;
  private readonly sheetName: string;
  private readonly createId: () => string;
  private readonly createEditKey: () => string;
  private readonly hashEditKey: (editKey: string) => string;
  private readonly now: () => Date;

  constructor(
    private readonly client: GoogleSheetsClient,
    private readonly options: GoogleSheetsSurveyRecordPersistenceOptions = {},
  ) {
    this.spreadsheetId = options.spreadsheetId ?? DEFAULT_SURVEY_SPREADSHEET_ID;
    this.sheetName = options.sheetName ?? DEFAULT_SURVEY_RAW_SHEET_NAME;
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.createEditKey = options.createEditKey ?? createEditKey;
    this.hashEditKey = options.hashEditKey ?? hashEditKey;
    this.now = options.now ?? (() => new Date());
  }

  async save(records: readonly SurveyRecord[]): Promise<SaveSurveyRecordsResult> {
    const headers = resolveColumns(await this.client.getHeaderRow(this.spreadsheetId, this.sheetName));
    const recordIds = records.map((record) => record.id ?? this.createId());
    const editKeys = records.map(() => this.createEditKey());
    const registeredAt = this.now().toISOString();
    const rows = records.map((record, index) => {
      const cells = recordCells(
        record,
        recordIds[index],
        this.hashEditKey(editKeys[index]),
        registeredAt,
        this.options,
      );
      return headers.map((header) => cells[header] ?? "");
    });

    await this.client.appendRows({ spreadsheetId: this.spreadsheetId, sheetName: this.sheetName, rows });
    return {
      savedCount: rows.length,
      recordIds,
      editCredentials: recordIds.map((recordId, index) => ({ recordId, editKey: editKeys[index] })),
    };
  }
}
