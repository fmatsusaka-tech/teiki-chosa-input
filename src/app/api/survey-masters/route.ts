import { NextResponse } from "next/server";
import { defaultSurveyMasterCatalog } from "../../../domain/survey-masters";
import { GoogleSheetsRestClient } from "../../../services/survey-record-persistence";
import { loadSurveyMasterCatalog } from "../../../services/survey-masters/sheet-survey-masters";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = GoogleSheetsRestClient.fromEnvironment();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) throw new Error("Spreadsheet ID is not configured.");
    return NextResponse.json(
      {
        catalog: await loadSurveyMasterCatalog(client, spreadsheetId),
        source: "sheet",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        catalog: defaultSurveyMasterCatalog,
        source: "fallback",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
