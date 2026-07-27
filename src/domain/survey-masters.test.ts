import { describe, expect, it } from "vitest";
import {
  BANSEI_VARIETY_NAME,
  getActiveMasterNames,
  type SurveyMasterItem,
  varietyMasters,
  WASE_VARIETY_NAME,
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

  it("正式な品種候補を指定順で返す", () => {
    expect(getActiveMasterNames(varietyMasters)).toEqual([
      WASE_VARIETY_NAME,
      "田口",
      "極早生",
      "ゆら早生",
      "YN26",
      "向山",
      BANSEI_VARIETY_NAME,
      "丹生",
      "清見",
      "せとか",
      "ポンカン",
      "不知火",
    ]);
  });
});
