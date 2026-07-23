import { describe, expect, it, vi } from "vitest";
import type { SurveyRecord } from "../../domain/survey-record";
import type { GoogleSheetsClient } from "./google-sheets-client";
import {
  DEFAULT_SURVEY_RAW_SHEET_NAME,
  DEFAULT_SURVEY_SPREADSHEET_ID,
  GoogleSheetsSurveyRecordPersistence,
  SURVEY_RAW_HEADERS,
} from "./google-sheets-persistence";

const record: SurveyRecord = {
  id: "2bd1ae56-2c98-4b0a-a946-d34786bc37dc",
  measuredAt: "2026-07-19T00:00:00.000Z",
  registeredAt: "2026-07-19T01:00:00.000Z",
  orchard: "徳田", variety: "早生", diametersMm: [55.1, 56.2], brix: null, acidity: 0,
  treatment: "マルチ", notes: "確認済み", source: "screenshot", confidence: null, warnings: [],
};

function clientWithHeaders(headers: readonly string[] = SURVEY_RAW_HEADERS) {
  return {
    getHeaderRow: vi.fn().mockResolvedValue(headers),
    appendRows: vi.fn().mockResolvedValue(undefined),
  } satisfies GoogleSheetsClient;
}

describe("GoogleSheetsSurveyRecordPersistence", () => {
  it("appends records to 調査原票 using the configured data bank", async () => {
    const client = clientWithHeaders();
    const persistence = new GoogleSheetsSurveyRecordPersistence(client, {
      operator: "調査担当", origin: "OCR確認画面", sourceText: "徳田 早生",
      createEditKey: () => "one-time-edit-key",
      hashEditKey: (key) => `hashed:${key}`,
      now: () => new Date("2026-07-20T00:00:00.000Z"),
    });

    await expect(persistence.save([record])).resolves.toEqual({
      savedCount: 1,
      recordIds: [record.id],
      editCredentials: [{ recordId: record.id, editKey: "one-time-edit-key" }],
    });
    expect(client.getHeaderRow).toHaveBeenCalledWith(DEFAULT_SURVEY_SPREADSHEET_ID, DEFAULT_SURVEY_RAW_SHEET_NAME);
    expect(client.appendRows).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: DEFAULT_SURVEY_SPREADSHEET_ID,
      sheetName: "調査原票",
      rows: [expect.arrayContaining([record.id, "徳田", "早生", "マルチ", "調査担当", "OCR確認画面", "徳田 早生"])],
    }));
    const row = client.appendRows.mock.calls[0][0].rows[0];
    expect(row[SURVEY_RAW_HEADERS.indexOf("編集キーハッシュ")]).toBe("hashed:one-time-edit-key");
    expect(row[SURVEY_RAW_HEADERS.indexOf("登録日時")]).toBe("2026-07-20T00:00:00.000Z");
    expect(row[SURVEY_RAW_HEADERS.indexOf("更新日時")]).toBe("2026-07-20T00:00:00.000Z");
    expect(row[SURVEY_RAW_HEADERS.indexOf("改訂番号")]).toBe(1);
    expect(row[SURVEY_RAW_HEADERS.indexOf("データ状態")]).toBe("有効");
    expect(row).not.toContain("one-time-edit-key");
  });

  it("resolves positions from reordered header names and leaves missing measurements blank", async () => {
    const headers = ["園地名", "酸度", "糖度", "横径3", ...SURVEY_RAW_HEADERS.filter((header) => !["園地名", "酸度", "糖度", "横径3"].includes(header))];
    const client = clientWithHeaders(headers);

    await new GoogleSheetsSurveyRecordPersistence(client).save([record]);

    const row = client.appendRows.mock.calls[0][0].rows[0];
    expect(row.slice(0, 4)).toEqual(["徳田", 0, "", ""]);
    expect(row[headers.indexOf("横径1")]).toBe(55.1);
    expect(row[headers.indexOf("横径2")]).toBe(56.2);
  });

  it("rejects a sheet whose required headers are missing without writing", async () => {
    const client = clientWithHeaders(SURVEY_RAW_HEADERS.filter((header) => header !== "登録ID"));
    const persistence = new GoogleSheetsSurveyRecordPersistence(client);

    await expect(persistence.save([record])).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(client.appendRows).not.toHaveBeenCalled();
  });

  it("generates an id when the confirmed record does not have one", async () => {
    const client = clientWithHeaders();
    const persistence = new GoogleSheetsSurveyRecordPersistence(client, { createId: () => "generated-id" });

    await expect(persistence.save([{ ...record, id: undefined }])).resolves.toMatchObject({ recordIds: ["generated-id"] });
  });

  it("rejects duplicate headers without writing", async () => {
    const client = clientWithHeaders([...SURVEY_RAW_HEADERS, "登録ID"]);
    await expect(new GoogleSheetsSurveyRecordPersistence(client).save([record]))
      .rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    expect(client.appendRows).not.toHaveBeenCalled();
  });
});
