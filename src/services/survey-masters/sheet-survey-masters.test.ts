import { describe, expect, it } from "vitest";
import { buildSurveyMasterCatalog } from "./sheet-survey-masters";

describe("buildSurveyMasterCatalog", () => {
  it("builds active masters from rows", () => {
    const catalog = buildSurveyMasterCatalog([
      ["種別", "正式名称", "別名", "既定品種", "有効"],
      ["園地", "新園地", "新園地ゆら", "ゆら早生", "TRUE"],
      ["品種", "ゆら早生", "ゆら", "", "TRUE"],
      ["処理区", "無処理区", "無処理", "", "TRUE"],
      ["園地", "旧園地", "", "早生", "FALSE"],
    ]);

    expect(catalog.orchards).toHaveLength(1);
    expect(catalog.orchards[0]).toMatchObject({
      canonicalName: "新園地",
      aliases: ["新園地ゆら"],
    });
    expect(catalog.orchardVarietyDefaults.新園地).toBe("ゆら早生");
    expect(catalog.treatments[0].canonicalName).toBe("無処理区");
  });

  it("rejects invalid headers", () => {
    expect(() => buildSurveyMasterCatalog([["園地名"]])).toThrow(
      "入力マスタの見出しが不足しています。",
    );
  });

  it("resolves headers by name even when there are more than five columns and they are reordered", () => {
    // Regression coverage for the getRows column-range bug (Issue #56): the raw sheet
    // may have extra columns (既定品種2/3) and needn't keep 種別/正式名称/別名/既定品種/有効
    // in their original A:E order.
    const catalog = buildSurveyMasterCatalog([
      ["有効", "既定品種2", "種別", "正式名称", "既定品種3", "別名", "既定品種"],
      ["TRUE", "田口", "園地", "新園地", "極早生", "新園地ゆら", "ゆら早生"],
    ]);

    expect(catalog.orchards).toHaveLength(1);
    expect(catalog.orchards[0]).toMatchObject({
      canonicalName: "新園地",
      aliases: ["新園地ゆら"],
    });
    expect(catalog.orchardVarietyDefaults.新園地).toBe("ゆら早生");
  });
});
