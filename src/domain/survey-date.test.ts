import { describe, expect, it } from "vitest";
import type { SurveyRecord } from "./survey-record";
import { applySurveyDate, formatLocalSurveyDate } from "./survey-date";

const record: SurveyRecord = {
  measuredAt: "2025-11-16T00:00:00.000Z",
  registeredAt: "2026-07-27T03:04:05.000Z",
  orchard: "徳田",
  variety: "早生",
  treatment: null,
  diametersMm: [40.1],
  brix: 10.5,
  acidity: null,
  notes: "",
  source: "text",
  confidence: 1,
  warnings: [],
};

describe("survey date", () => {
  it("formats the user's local calendar date for the initial value", () => {
    expect(formatLocalSurveyDate(new Date(2026, 6, 27, 23, 30))).toBe(
      "2026-07-27",
    );
  });

  it("applies the selected date to every record without changing registration time", () => {
    const updated = applySurveyDate([record, { ...record, orchard: "上中島" }], "2026-07-20");

    expect(updated.map((item) => item.measuredAt)).toEqual([
      "2026-07-20T00:00:00.000Z",
      "2026-07-20T00:00:00.000Z",
    ]);
    expect(updated.every((item) => item.registeredAt === record.registeredAt)).toBe(true);
  });

  it("leaves records unchanged when the date is invalid", () => {
    expect(applySurveyDate([record], "")).toEqual([record]);
  });
});
