export type SurveyMasterItem = {
  id: string;
  canonicalName: string;
  aliases: readonly string[];
  isActive: boolean;
};

export type SurveyMasterCatalog = {
  orchards: readonly SurveyMasterItem[];
  varieties: readonly SurveyMasterItem[];
  treatments: readonly SurveyMasterItem[];
  orchardVarietyDefaults: Readonly<Record<string, string>>;
};

export const WASE_VARIETY_NAME = "早生（宮川・興津 等、又は山下紅）";

export const orchardMasters: readonly SurveyMasterItem[] = [
  { id: "arinaka", canonicalName: "有中", aliases: [], isActive: true },
  { id: "yoshikawa", canonicalName: "吉川", aliases: [], isActive: true },
  { id: "naru-1", canonicalName: "なる1", aliases: ["なる１"], isActive: true },
  { id: "naru-2", canonicalName: "なる2", aliases: ["なる２"], isActive: true },
  { id: "kaminakajima", canonicalName: "上中島", aliases: [], isActive: true },
  { id: "shimo-machi", canonicalName: "下町", aliases: [], isActive: true },
  { id: "tokuda", canonicalName: "徳田", aliases: [], isActive: true },
  { id: "beni-shimo", canonicalName: "紅下", aliases: [], isActive: true },
  { id: "beni-higashi", canonicalName: "紅東", aliases: [], isActive: true },
  { id: "beni-izumo", canonicalName: "紅出雲", aliases: [], isActive: true },
  { id: "izumo-taguchi", canonicalName: "出雲田口", aliases: [], isActive: true },
  { id: "koshima", canonicalName: "越間", aliases: ["越間ゆら"], isActive: true },
];

export const varietyMasters: readonly SurveyMasterItem[] = [
  { id: "yura-wase", canonicalName: "ゆら早生", aliases: [], isActive: true },
  {
    id: "wase",
    canonicalName: WASE_VARIETY_NAME,
    aliases: ["早生", "宮川", "興津", "山下紅", "早生（宮川・興津など）"],
    isActive: true,
  },
  { id: "taguchi", canonicalName: "田口", aliases: [], isActive: true },
];

export const orchardVarietyDefaults: Readonly<Record<string, string>> = {
  有中: "ゆら早生",
  吉川: "ゆら早生",
  なる1: "ゆら早生",
  なる2: WASE_VARIETY_NAME,
  上中島: WASE_VARIETY_NAME,
  下町: WASE_VARIETY_NAME,
  徳田: WASE_VARIETY_NAME,
  出雲田口: "田口",
  越間: "ゆら早生",
};

export function getActiveMasterNames(items: readonly SurveyMasterItem[]): string[] {
  return items.filter((item) => item.isActive).map((item) => item.canonicalName);
}

export const treatmentMasters: readonly SurveyMasterItem[] = [
  { id: "untreated", canonicalName: "無処理区", aliases: ["無処理"], isActive: true },
  { id: "ski", canonicalName: "スキー", aliases: [], isActive: true },
  { id: "miyobi", canonicalName: "ミヨビ", aliases: [], isActive: true },
];

export const defaultSurveyMasterCatalog: SurveyMasterCatalog = {
  orchards: orchardMasters,
  varieties: varietyMasters,
  treatments: treatmentMasters,
  orchardVarietyDefaults,
};
