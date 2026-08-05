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

const DIAMETER_HEADERS = Array.from({ length: 10 }, (_, index) => `横径${index + 1}` as RawHeader);

function parseCellNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

const JST_SHEET_DATETIME_PATTERN =
  /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;

/**
 * Parses a `計測日` cell into an absolute instant (epoch ms) rather than comparing display
 * strings directly. Google Sheets returns date-typed cells using the spreadsheet's own
 * number-format rendering (e.g. it may drop the zero-padding `formatSheetDateTime` writes,
 * such as "2026/7/19 9:00:00" instead of "2026/07/19 09:00:00"), so an exact string match
 * against a freshly-formatted value is not reliable. Falls back to native Date parsing for
 * rows registered before spec version 1.1.0, which kept the previous ISO 8601 string.
 */
function parseMeasuredAtInstant(value: string): number | null {
  const trimmed = value.trim();
  const jstMatch = trimmed.match(JST_SHEET_DATETIME_PATTERN);
  if (jstMatch) {
    const [, year, month, day, hour, minute, second] = jstMatch.map(Number);
    return Date.UTC(year, month - 1, day, hour, minute, second) - 9 * 60 * 60 * 1000;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/**
 * Identifies a record by its observed values only (orchard/variety/treatment/measuredAt/
 * diameters(順不同)/brix/acidity), per Issue #54's definition of a "complete duplicate".
 * 備考 is deliberately excluded, matching the confirmed spec.
 */
function duplicateKey(fields: {
  orchard: string;
  variety: string;
  treatment: string;
  measuredAtInstant: number | null;
  diameters: readonly number[];
  brix: number | null;
  acidity: number | null;
}): string {
  return JSON.stringify([
    fields.orchard.trim(),
    fields.variety.trim(),
    fields.treatment.trim(),
    fields.measuredAtInstant,
    [...fields.diameters].sort((a, b) => a - b),
    fields.brix,
    fields.acidity,
  ]);
}

function recordDuplicateKey(record: SurveyRecord): string {
  return duplicateKey({
    orchard: record.orchard,
    variety: record.variety,
    treatment: record.treatment ?? "",
    measuredAtInstant: parseMeasuredAtInstant(record.measuredAt),
    diameters: record.diametersMm,
    brix: record.brix,
    acidity: record.acidity,
  });
}

/** Builds duplicate-detection keys for every existing 有効 row in `調査原票`. */
function existingActiveDuplicateKeys(
  existingRows: readonly (readonly string[])[],
  headers: readonly RawHeader[],
): string[] {
  const indexOf = (header: RawHeader) => headers.indexOf(header);
  const statusIndex = indexOf("データ状態");
  const orchardIndex = indexOf("園地名");
  const varietyIndex = indexOf("品種");
  const treatmentIndex = indexOf("処理区");
  const measuredAtIndex = indexOf("計測日");
  const brixIndex = indexOf("糖度");
  const acidityIndex = indexOf("酸度");
  const diameterIndexes = DIAMETER_HEADERS.map(indexOf);

  return existingRows
    .filter((row) => (row[statusIndex] ?? "").trim() === "有効")
    .map((row) => duplicateKey({
      orchard: row[orchardIndex] ?? "",
      variety: row[varietyIndex] ?? "",
      treatment: row[treatmentIndex] ?? "",
      measuredAtInstant: parseMeasuredAtInstant(row[measuredAtIndex] ?? ""),
      diameters: diameterIndexes
        .map((index) => parseCellNumber(row[index]))
        .filter((value): value is number => value !== null),
      brix: parseCellNumber(row[brixIndex]),
      acidity: parseCellNumber(row[acidityIndex]),
    }));
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
    const existingRows = await this.client.getRows(this.spreadsheetId, this.sheetName);
    const seenKeys = new Set(existingActiveDuplicateKeys(existingRows, headers));

    const recordIds = records.map((record) => record.id ?? this.createId());
    const editKeys = records.map(() => this.createEditKey());
    const registeredAt = this.now().toISOString();

    const acceptedIndexes: number[] = [];
    const skippedIds: string[] = [];
    records.forEach((record, index) => {
      const key = recordDuplicateKey(record);
      // Records within the same batch are folded into the seen set as they're accepted,
      // so submitting the same content twice in one registration is also caught.
      if (seenKeys.has(key)) {
        skippedIds.push(recordIds[index]);
        return;
      }
      seenKeys.add(key);
      acceptedIndexes.push(index);
    });

    const rows = acceptedIndexes.map((index) => {
      const cells = recordCells(
        records[index],
        recordIds[index],
        this.hashEditKey(editKeys[index]),
        registeredAt,
        this.options,
      );
      return headers.map((header) => cells[header] ?? "");
    });

    if (rows.length > 0) {
      await this.client.appendRows({ spreadsheetId: this.spreadsheetId, sheetName: this.sheetName, rows });
    }

    return {
      savedCount: rows.length,
      recordIds: acceptedIndexes.map((index) => recordIds[index]),
      editCredentials: acceptedIndexes.map((index) => (
        { recordId: recordIds[index], editKey: editKeys[index] }
      )),
      skippedCount: skippedIds.length,
      skippedIds,
    };
  }
}
