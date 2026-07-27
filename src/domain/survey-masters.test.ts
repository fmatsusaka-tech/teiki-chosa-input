import { describe, expect, it } from "vitest";
import {
  getActiveMasterNames,
  type SurveyMasterItem,
  varietyMasters,
} from "./survey-masters";

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

  it("算出基礎と追加指定の品種を既定候補として網羅する", () => {
    expect(getActiveMasterNames(varietyMasters)).toEqual(
      expect.arrayContaining([
        "ゆら早生",
        "興津早生",
        "田口早生",
        "向山",
        "林",
        "丹生",
        "せとか",
        "清見",
        "YN26",
        "極早生",
      ]),
    );
  });
});
