import {
  defaultSurveyMasterCatalog,
  type SurveyMasterCatalog,
  type SurveyMasterItem,
} from "../../domain/survey-masters";
import type { GoogleSheetsClient } from "../survey-record-persistence";

export const SURVEY_MASTER_SHEET_NAME = "入力マスタ";
export const SURVEY_MASTER_HEADERS = ["種別", "正式名称", "別名", "既定品種", "有効"] as const;

function enabled(value: string): boolean {
  return !["FALSE", "false", "0", "無効"].includes(value.trim());
}

function splitAliases(value: string): string[] {
  return value.split(/[、,;\n]/).map((item) => item.trim()).filter(Boolean);
}

export function buildSurveyMasterCatalog(
  rows: readonly (readonly string[])[],
): SurveyMasterCatalog {
  const headers = rows[0] ?? [];
  const indexes = Object.fromEntries(
    SURVEY_MASTER_HEADERS.map((header) => [header, headers.indexOf(header)]),
  ) as Record<(typeof SURVEY_MASTER_HEADERS)[number], number>;
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new Error("入力マスタの見出しが不足しています。");
  }

  const orchards: SurveyMasterItem[] = [];
  const varieties: SurveyMasterItem[] = [];
  const treatments: SurveyMasterItem[] = [];
  const defaults: Record<string, string> = {};

  rows.slice(1).forEach((row, rowIndex) => {
    const kind = row[indexes.種別]?.trim() ?? "";
    const canonicalName = row[indexes.正式名称]?.trim() ?? "";
    if (!canonicalName || !enabled(row[indexes.有効] ?? "")) return;
    const item = {
      id: `sheet-${rowIndex + 2}`,
      canonicalName,
      aliases: splitAliases(row[indexes.別名] ?? ""),
      isActive: true,
    };
    if (kind === "園地") {
      orchards.push(item);
      const variety = row[indexes.既定品種]?.trim();
      if (variety) defaults[canonicalName] = variety;
    } else if (kind === "品種") {
      varieties.push(item);
    } else if (kind === "処理区") {
      treatments.push(item);
    }
  });

  return {
    orchards: orchards.length > 0 ? orchards : defaultSurveyMasterCatalog.orchards,
    varieties: varieties.length > 0 ? varieties : defaultSurveyMasterCatalog.varieties,
    treatments: treatments.length > 0 ? treatments : defaultSurveyMasterCatalog.treatments,
    orchardVarietyDefaults: {
      ...defaultSurveyMasterCatalog.orchardVarietyDefaults,
      ...defaults,
    },
  };
}

export async function loadSurveyMasterCatalog(
  client: GoogleSheetsClient,
  spreadsheetId: string,
): Promise<SurveyMasterCatalog> {
  return buildSurveyMasterCatalog(
    await client.getRows(spreadsheetId, SURVEY_MASTER_SHEET_NAME),
  );
}
