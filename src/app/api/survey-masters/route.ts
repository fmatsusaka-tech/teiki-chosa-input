import { NextResponse } from "next/server";
import { defaultSurveyMasterCatalog } from "../../../domain/survey-masters";
import { GoogleSheetsRestClient } from "../../../services/survey-record-persistence";
import { loadSurveyMasterCatalog } from "../../../services/survey-masters/sheet-survey-masters";
import { loadTreatmentSuggestionsByOrchard } from "../../../services/survey-masters/survey-treatment-suggestions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = GoogleSheetsRestClient.fromEnvironment();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) throw new Error("Spreadsheet ID is not configured.");
    const [catalogResult, treatmentResult] = await Promise.allSettled([
      loadSurveyMasterCatalog(client, spreadsheetId),
      loadTreatmentSuggestionsByOrchard(client, spreadsheetId),
    ]);
    return NextResponse.json(
      {
        catalog: catalogResult.status === "fulfilled"
          ? catalogResult.value
          : defaultSurveyMasterCatalog,
        treatmentSuggestionsByOrchard: treatmentResult.status === "fulfilled"
          ? treatmentResult.value
          : {},
        source: catalogResult.status === "fulfilled" || treatmentResult.status === "fulfilled"
          ? "sheet"
          : "fallback",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        catalog: defaultSurveyMasterCatalog,
        treatmentSuggestionsByOrchard: {},
        source: "fallback",
        fallbackReason:
          error instanceof Error ? error.message : "入力マスタを取得できませんでした。",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
