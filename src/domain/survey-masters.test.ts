import { describe, expect, it } from "vitest";
import { getActiveMasterNames, type SurveyMasterItem } from "./survey-masters";

describe("getActiveMasterNames", () => {
  it("有効なマスタの正式名称だけを入力候補として返す", () => {
    const items: SurveyMasterItem[] = [
      {
        id: "known",
        canonicalName: "既存品種",
        aliases: ["既存"],
        isActive: true,
      },
      {
        id: "inactive",
        canonicalName: "使用停止品種",
        aliases: [],
        isActive: false,
      },
      {
        id: "new",
        canonicalName: "新品種",
        aliases: [],
        isActive: true,
      },
    ];

    expect(getActiveMasterNames(items)).toEqual(["既存品種", "新品種"]);
  });
});
