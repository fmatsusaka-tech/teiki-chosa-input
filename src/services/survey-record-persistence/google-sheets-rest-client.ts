import { createSign } from "node:crypto";
import type { GoogleSheetsAppendRequest, GoogleSheetsClient } from "./google-sheets-client";
import { SurveyRecordPersistenceError } from "./persistence-error";

type Fetch = typeof fetch;

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

/** Google Sheets REST client whose service-account credentials never cross the server boundary. */
export class GoogleSheetsRestClient implements GoogleSheetsClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly credentials: { email: string; privateKey: string },
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  static fromEnvironment(env: Record<string, string | undefined> = process.env) {
    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
    if (!email || !privateKey) {
      throw new SurveyRecordPersistenceError(
        "PROVIDER_UNAVAILABLE",
        "Google Sheetsのサーバー認証情報が設定されていません。",
      );
    }
    return new GoogleSheetsRestClient({ email, privateKey });
  }

  async getHeaderRow(spreadsheetId: string, sheetName: string): Promise<readonly string[]> {
    const range = encodeURIComponent(`'${sheetName.replaceAll("'", "''")}'!1:1`);
    const response = await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    );
    const payload = await response.json() as { values?: unknown[][] };
    return (payload.values?.[0] ?? []).map(String);
  }

  async getRows(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<readonly (readonly string[])[]> {
    // No column bound: callers resolve fields by header name, so this must return every
    // column the sheet actually has rather than assuming they all fit in a fixed range.
    const range = encodeURIComponent(`'${sheetName.replaceAll("'", "''")}'`);
    const response = await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    );
    const payload = await response.json() as { values?: unknown[][] };
    return (payload.values ?? []).map((row) => row.map((cell) => String(cell)));
  }

  async appendRows(request: GoogleSheetsAppendRequest): Promise<void> {
    const range = encodeURIComponent(`'${request.sheetName.replaceAll("'", "''")}'!A1`);
    await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(request.spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: request.rows }) },
    );
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json", ...init.headers },
    });
    if (!response.ok) {
      throw new SurveyRecordPersistenceError("PROVIDER_ERROR", `Google Sheetsとの通信に失敗しました（${response.status}）。`);
    }
    return response;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
      iss: this.credentials.email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }))}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    const assertion = `${unsigned}.${signer.sign(this.credentials.privateKey, "base64url")}`;
    const response = await this.fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    if (!response.ok) throw new SurveyRecordPersistenceError("PROVIDER_UNAVAILABLE", "Google Sheetsの認証に失敗しました。");
    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new SurveyRecordPersistenceError("PROVIDER_UNAVAILABLE", "Google Sheetsの認証応答が不正です。");
    this.token = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }
}
