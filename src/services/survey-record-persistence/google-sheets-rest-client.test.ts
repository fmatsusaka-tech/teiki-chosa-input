import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GoogleSheetsRestClient } from "./google-sheets-rest-client";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function tokenResponse(accessToken = "test-access-token") {
  return jsonResponse({ access_token: accessToken, expires_in: 3600 });
}

describe("GoogleSheetsRestClient", () => {
  it("fetches the full header row without truncating columns", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ values: [["種別", "正式名称", "別名", "既定品種", "有効", "既定品種2", "既定品種3"]] }));
    const client = new GoogleSheetsRestClient({ email: "svc@example.com", privateKey }, fetch);

    const headers = await client.getHeaderRow("sheet-id", "入力マスタ");

    expect(headers).toEqual(["種別", "正式名称", "別名", "既定品種", "有効", "既定品種2", "既定品種3"]);
    const requestedUrl = fetch.mock.calls[1]?.[0] as string;
    expect(requestedUrl).toContain(encodeURIComponent("'入力マスタ'!1:1"));
  });

  it("fetches rows spanning more than five columns without a fixed column bound", async () => {
    const wideRow = ["園地", "新園地", "", "ゆら早生", "TRUE", "田口", "極早生"];
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ values: [wideRow] }));
    const client = new GoogleSheetsRestClient({ email: "svc@example.com", privateKey }, fetch);

    const rows = await client.getRows("sheet-id", "入力マスタ");

    expect(rows).toEqual([wideRow]);
    const requestedUrl = fetch.mock.calls[1]?.[0] as string;
    expect(requestedUrl).not.toContain("A:E");
    expect(requestedUrl).not.toContain("A%3AE");
    expect(requestedUrl).toContain(encodeURIComponent("'入力マスタ'"));
  });

  it("appends rows via a POST request with the confirmed values", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({}));
    const client = new GoogleSheetsRestClient({ email: "svc@example.com", privateKey }, fetch);

    await client.appendRows({
      spreadsheetId: "sheet-id",
      sheetName: "調査原票",
      rows: [["id-1", "徳田", "早生"]],
    });

    const [url, init] = fetch.mock.calls[1] ?? [];
    expect(url as string).toContain(":append");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ values: [["id-1", "徳田", "早生"]] });
  });

  it("reuses a cached access token across multiple calls", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(tokenResponse("cached-token"))
      .mockResolvedValueOnce(jsonResponse({ values: [["a"]] }))
      .mockResolvedValueOnce(jsonResponse({ values: [["b"]] }));
    const client = new GoogleSheetsRestClient({ email: "svc@example.com", privateKey }, fetch);

    await client.getRows("sheet-id", "sheet1");
    await client.getRows("sheet-id", "sheet2");

    const tokenRequests = fetch.mock.calls.filter(([url]) => String(url).includes("oauth2.googleapis.com"));
    expect(tokenRequests).toHaveLength(1);
    const secondCallHeaders = fetch.mock.calls[2]?.[1]?.headers as Record<string, string>;
    expect(secondCallHeaders.authorization).toBe("Bearer cached-token");
  });

  it("rejects when the Sheets API responds with an error status", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    const client = new GoogleSheetsRestClient({ email: "svc@example.com", privateKey }, fetch);

    await expect(client.getRows("sheet-id", "調査原票")).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("reports token issuance failures as unavailable", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(new Response(null, { status: 401 }));
    const client = new GoogleSheetsRestClient({ email: "svc@example.com", privateKey }, fetch);

    await expect(client.getRows("sheet-id", "調査原票")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("reports a token response without an access_token as unavailable", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(jsonResponse({}));
    const client = new GoogleSheetsRestClient({ email: "svc@example.com", privateKey }, fetch);

    await expect(client.getRows("sheet-id", "調査原票")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  describe("fromEnvironment", () => {
    it("requires both the service account email and private key", () => {
      expect(() => GoogleSheetsRestClient.fromEnvironment({})).toThrow(/認証情報/);
      expect(() => GoogleSheetsRestClient.fromEnvironment({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "svc@example.com",
      })).toThrow(/認証情報/);
    });

    it("builds a client from environment variables, unescaping literal newlines", () => {
      const client = GoogleSheetsRestClient.fromEnvironment({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "svc@example.com",
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: privateKey.replaceAll("\n", "\\n"),
      });
      expect(client).toBeInstanceOf(GoogleSheetsRestClient);
    });
  });
});
