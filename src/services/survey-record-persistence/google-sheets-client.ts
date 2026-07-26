export type GoogleSheetsAppendRequest = {
  spreadsheetId: string;
  sheetName: string;
  rows: readonly (readonly (string | number)[])[];
};

/** Server-side boundary for the Google Sheets API client. */
export interface GoogleSheetsClient {
  getHeaderRow(spreadsheetId: string, sheetName: string): Promise<readonly string[]>;
  getRows(spreadsheetId: string, sheetName: string): Promise<readonly (readonly string[])[]>;
  appendRows(request: GoogleSheetsAppendRequest): Promise<void>;
}
