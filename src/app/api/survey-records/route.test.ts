import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const originalEnv = { ...process.env };

function confirmedRecordRequestBody() {
  return {
    records: [
      {
        measuredAt: "2026-07-19T00:00:00.000Z",
        registeredAt: "2026-07-19T00:00:00.000Z",
        orchard: "徳田",
        variety: "早生",
        diametersMm: [40.1],
        brix: 10,
        acidity: null,
        source: "text",
        confidence: null,
      },
    ],
  };
}

describe("POST /api/survey-records", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails clearly instead of falling back to a default spreadsheet when the ID is not configured", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "dummy-key-for-test";
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    const request = new Request("http://localhost/api/survey-records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(confirmedRecordRequestBody()),
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    const body = await response.json() as { error?: string };
    expect(body.error).toContain("スプレッドシートID");
  });
});
