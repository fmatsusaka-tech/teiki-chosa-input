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
  splitAliases_: (value: unknown) => string[];
  buildKnownNamesByKind_: (
    masterRows: unknown[][],
    kindIndex: number,
    nameIndex: number,
    aliasIndex: number,
    kind: string,
  ) => Set<string>;
  collectDistinctInOrder_: (rows: unknown[][], columnIndex: number) => string[];
  findUnknownNames_: (observedNames: string[], knownNames: Set<string>) => string[];
  buildOrchardVarietyObservations_: (
    rawRows: unknown[][],
    orchardIndex: number,
    varietyIndex: number,
    knownVarietyNames: Set<string>,
  ) => Record<string, string[]>;
  fillVarietySlots_: (currentSlots: unknown[], observedVarieties: string[], maxSlots: number) => unknown[];
};

function loadHelpers(): AppsScriptHelpers {
  const source = readFileSync(new URL("./Code.gs", import.meta.url), "utf8");
  const context: Record<string, unknown> = {};
  vm.runInNewContext(
    `${source}\nthis.helpers = { ensureDiameterOutputHeaders_, buildSurveyDataRow_, surveyDateParts_, validateCanonicalHeaders_, optionalNumber_, splitAliases_, buildKnownNamesByKind_, collectDistinctInOrder_, findUnknownNames_, buildOrchardVarietyObservations_, fillVarietySlots_ };`,
    context,
  );
  return context.helpers as AppsScriptHelpers;
}

const {
  ensureDiameterOutputHeaders_, buildSurveyDataRow_, surveyDateParts_,
  validateCanonicalHeaders_, optionalNumber_, splitAliases_, buildKnownNamesByKind_,
  collectDistinctInOrder_, findUnknownNames_, buildOrchardVarietyObservations_, fillVarietySlots_,
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

describe("入力マスタの自動学習", () => {
  it("別名を読点・カンマ・セミコロン・改行で分割する", () => {
    expect(splitAliases_("宮川、興津,山下紅;早生\n田口")).toEqual([
      "宮川", "興津", "山下紅", "早生", "田口",
    ]);
    expect(splitAliases_("")).toEqual([]);
    expect(splitAliases_(null)).toEqual([]);
  });

  it("種別ごとに正式名称と別名を既知集合として集める", () => {
    const masterRows = [
      ["園地", "徳田", "とくだ、徳田園", "早生", "", "", true],
      ["処理区", "無処理区", "", "", "", "", true],
      ["品種", "早生（宮川・興津 等、又は山下紅）", "宮川、興津、山下紅、早生", "", "", "", true],
    ];
    const orchards = buildKnownNamesByKind_(masterRows, 0, 1, 2, "園地");
    expect(orchards.has("徳田")).toBe(true);
    expect(orchards.has("とくだ")).toBe(true);
    expect(orchards.has("徳田園")).toBe(true);
    expect(orchards.has("無処理区")).toBe(false);

    const varieties = buildKnownNamesByKind_(masterRows, 0, 1, 2, "品種");
    expect(varieties.has("宮川")).toBe(true);
    expect(varieties.has("早生（宮川・興津 等、又は山下紅）")).toBe(true);
  });

  it("重複と空欄を除いて観測順に園地名を集める", () => {
    const rows = [["徳田"], ["下田"], ["徳田"], [""], [null]];
    expect(collectDistinctInOrder_(rows, 0)).toEqual(["徳田", "下田"]);
  });

  it("既知集合に無い名前だけを未登録として返す", () => {
    const known = new Set(["徳田"]);
    expect(findUnknownNames_(["徳田", "下田", "上中島"], known)).toEqual(["下田", "上中島"]);
  });

  it("園地ごとに既知品種のみを観測順・重複除去で集める", () => {
    const knownVarieties = new Set(["早生", "田口"]);
    const rows = [
      ["徳田", "早生"],
      ["徳田", "不明品種"],
      ["徳田", "田口"],
      ["徳田", "早生"],
      ["下田", "田口"],
      ["", "早生"],
      ["上中島", ""],
    ];
    const observations = buildOrchardVarietyObservations_(rows, 0, 1, knownVarieties);
    expect(observations["徳田"]).toEqual(["早生", "田口"]);
    expect(observations["下田"]).toEqual(["田口"]);
    expect(observations["上中島"]).toBeUndefined();
  });

  describe("既定品種スロットの補充", () => {
    it("空欄スロットだけを観測順の品種で埋める", () => {
      const result = fillVarietySlots_(["", "", ""], ["早生", "田口", "ゆら早生"], 3);
      expect(result).toEqual(["早生", "田口", "ゆら早生"]);
    });

    it("既に入っている値は上書きしない", () => {
      const result = fillVarietySlots_(["早生", "", ""], ["田口", "早生", "ゆら早生"], 3);
      expect(result).toEqual(["早生", "田口", "ゆら早生"]);
    });

    it("既存スロットに無い品種だけを新規に補充する", () => {
      const result = fillVarietySlots_(["早生", "田口", ""], ["田口", "早生", "ゆら早生"], 3);
      expect(result).toEqual(["早生", "田口", "ゆら早生"]);
    });

    it("4件目以降の品種は追加しない(先着3件)", () => {
      const result = fillVarietySlots_(["早生", "田口", "ゆら早生"], ["YN26"], 3);
      expect(result).toEqual(["早生", "田口", "ゆら早生"]);
    });

    it("観測数がスロット数より少なければ残りは空欄のまま", () => {
      const result = fillVarietySlots_(["", "", ""], ["早生"], 3);
      expect(result).toEqual(["早生", "", ""]);
    });
  });
});
