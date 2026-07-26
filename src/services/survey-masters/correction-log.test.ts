import { describe, expect, it, vi } from "vitest";
import type { SurveyRecord } from "../../domain/survey-record";
import type { GoogleSheetsClient } from "../survey-record-persistence";
import {
  appendCorrectionLog,
  CORRECTION_LOG_HEADERS,
} from "./correction-log";

const record: SurveyRecord = {
  measuredAt: "2026-07-26T00:00:00.000Z",
  registeredAt: "2026-07-26T00:00:00.000Z",
  orchard: "新園地",
  variety: "ゆら早生",
  diametersMm: [41, 42],
  brix: null,
  acidity: null,
  notes: "補正済み",
  source: "text",
  confidence: 0.8,
  warnings: [],
};

describe("appendCorrectionLog", () => {
  it("stores source text with confirmed values", async () => {
    const client = {
      getHeaderRow: vi.fn().mockResolvedValue(CORRECTION_LOG_HEADERS),
      getRows: vi.fn().mockResolvedValue([]),
      appendRows: vi.fn().mockResolvedValue(undefined),
    } satisfies GoogleSheetsClient;

    await appendCorrectionLog(
      client,
      "sheet",
      "新園地\n41\n42",
      [record],
      new Date("2026-07-26T01:00:00.000Z"),
    );

    expect(client.appendRows).toHaveBeenCalledWith({
      spreadsheetId: "sheet",
      sheetName: "解析補正ログ",
      rows: [[
        "2026-07-26T01:00:00.000Z",
        "新園地\n41\n42",
        "新園地",
        "ゆら早生",
        "",
        "補正済み",
        "41,42",
        "",
        "",
        "text",
      ]],
    });
  });
});
