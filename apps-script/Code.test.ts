import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type AppsScriptHelpers = {
  ensureDiameterOutputHeaders_: (headers: string[]) => string[];
  buildSurveyDataRow_: (
    rawHeaders: string[],
    rawRow: unknown[],
    surveyHeaders: string[],
  ) => unknown[];
  surveyDateParts_: (value: unknown) => { year: number; month: number; day: number } | null;
  validateCanonicalHeaders_: (headers: string[]) => string[];
  optionalNumber_: (value: unknown) => number | "";
};

function loadHelpers(): AppsScriptHelpers {
  const source = readFileSync(new URL("./Code.gs", import.meta.url), "utf8");
  const context: Record<string, unknown> = {};
  vm.runInNewContext(
    `${source}\nthis.helpers = { ensureDiameterOutputHeaders_, buildSurveyDataRow_, surveyDateParts_, validateCanonicalHeaders_, optionalNumber_ };`,
    context,
  );
  return context.helpers as AppsScriptHelpers;
}

const {
  ensureDiameterOutputHeaders_, buildSurveyDataRow_, surveyDateParts_,
  validateCanonicalHeaders_, optionalNumber_,
} = loadHelpers();

describe("調査データの横径変換", () => {
  it("備考の後に玉1〜玉10を置き、既存列の順序を維持する", () => {
    const headers = [
      "調査日", "園地", "品種", "備考", "横径個数", "横径平均", "横径最小", "横径最大",
      "糖度", "酸度", "糖酸比", "データ状態", "入力方法", "入力者", "送信元",
    ];

    const result = ensureDiameterOutputHeaders_(headers);

    expect(result.slice(4, 14)).toEqual(Array.from({ length: 10 }, (_, index) => `玉${index + 1}横径`));
    expect(result.slice(14)).toEqual(headers.slice(4));
  });

  it("横径を空欄のままコピーし、空欄を除外して集計する", () => {
    const rawHeaders = [
      "計測日", "園地名", "備考", "横径1", "横径2", "横径3", "横径4", "糖度", "入力方法",
    ];
    const rawRow = ["2026/07/19", "徳田", "確認済み", 51.2, "", 49.8, null, 10.5, "OCR"];
    const surveyHeaders = ensureDiameterOutputHeaders_([
      "調査日", "園地", "備考", "横径個数", "横径平均", "横径最小", "横径最大", "糖度", "入力方法",
    ]);

    const row = buildSurveyDataRow_(rawHeaders, rawRow, surveyHeaders);
    const value = (header: string) => row[surveyHeaders.indexOf(header)];

    expect(value("玉1横径")).toBe(51.2);
    expect(value("玉2横径")).toBe("");
    expect(value("玉3横径")).toBe(49.8);
    expect(value("玉4横径")).toBe("");
    expect(value("横径個数")).toBe(2);
    expect(value("横径平均")).toBe(50.5);
    expect(value("横径最小")).toBe(49.8);
    expect(value("横径最大")).toBe(51.2);
    expect(value("糖度")).toBe(10.5);
    expect(value("入力方法")).toBe("OCR");
  });

  it("横径がすべて空欄なら集計値も空欄にする", () => {
    const rawHeaders = ["横径1", "横径2"];
    const surveyHeaders = ensureDiameterOutputHeaders_([
      "備考", "横径個数", "横径平均", "横径最小", "横径最大", "糖度",
    ]);
    const row = buildSurveyDataRow_(rawHeaders, ["", null], surveyHeaders);

    for (const header of ["横径個数", "横径平均", "横径最小", "横径最大"]) {
      expect(row[surveyHeaders.indexOf(header)]).toBe("");
    }
  });

  it("日付、糖酸、必須項目から従来の派生項目を再生成する", () => {
    const rawHeaders = ["計測日", "園地名", "品種", "糖度", "酸度"];
    const rawRow = [new Date(2026, 0, 5), "徳田", "早生", 10.5, 1.5];
    const surveyHeaders = [
      "調査日", "園地", "品種", "年度", "年", "月", "調査基準月", "調査区分",
      "糖度", "酸度", "糖酸比", "データ状態",
    ];

    const row = buildSurveyDataRow_(rawHeaders, rawRow, surveyHeaders);
    const value = (header: string) => row[surveyHeaders.indexOf(header)];

    expect(value("年度")).toBe(2025);
    expect(value("年")).toBe(2026);
    expect(value("月")).toBe(1);
    expect(value("調査基準月")).toBe(1);
    expect(value("調査区分")).toBe("前半");
    expect(value("糖酸比")).toBe(7);
    expect(value("データ状態")).toBe("有効");
  });

  it("25日以降を翌月前半に対応付け、判定不能な値を捏造しない", () => {
    const rawHeaders = ["計測日", "園地名", "品種", "糖度", "酸度"];
    const surveyHeaders = ["調査基準月", "調査区分", "糖酸比", "データ状態"];
    const validRow = buildSurveyDataRow_(
      rawHeaders,
      [new Date(2026, 6, 25), "徳田", "早生", 10, 0],
      surveyHeaders,
    );
    const invalidRow = buildSurveyDataRow_(rawHeaders, ["不明", "", "早生", "", 1.2], surveyHeaders);

    expect(validRow).toEqual([8, "前半", "", "有効"]);
    expect(invalidRow).toEqual(["", "", "", "要確認"]);
    expect(surveyDateParts_("不明")).toBeNull();
  });

  it("正本の取消状態を派生判定で上書きしない", () => {
    const rawHeaders = ["計測日", "園地名", "品種", "データ状態"];
    const surveyHeaders = ["調査日", "園地", "品種", "データ状態"];
    const row = buildSurveyDataRow_(
      rawHeaders,
      [new Date(2026, 6, 25), "徳田", "早生", "取消"],
      surveyHeaders,
    );
    expect(row[surveyHeaders.indexOf("データ状態")]).toBe("取消");
  });
});

describe("Input正本契約", () => {
  const canonicalHeaders = [
    "登録ID", "編集キーハッシュ", "登録日時", "更新日時", "改訂番号", "データ状態",
    "計測日", "園地名", "品種", "処理区", "備考",
    ...Array.from({ length: 10 }, (_, index) => `横径${index + 1}`),
    "糖度", "酸度", "入力方法", "入力者", "送信元", "原文メモ",
  ];

  it("列順が変わっても正式見出しを受け付ける", () => {
    const reordered = [...canonicalHeaders].reverse();
    expect(validateCanonicalHeaders_(reordered)).toEqual(reordered);
  });

  it("不足見出しと重複見出しを拒否する", () => {
    expect(() => validateCanonicalHeaders_(canonicalHeaders.slice(1))).toThrow(/不足: 登録ID/);
    expect(() => validateCanonicalHeaders_([...canonicalHeaders, "登録ID"])).toThrow(/重複: 登録ID/);
  });

  it("数値欠測を0へ変換しない", () => {
    expect(optionalNumber_(null)).toBe("");
    expect(optionalNumber_("")).toBe("");
    expect(optionalNumber_(0)).toBe(0);
    expect(optionalNumber_("10.5")).toBe(10.5);
  });
});
