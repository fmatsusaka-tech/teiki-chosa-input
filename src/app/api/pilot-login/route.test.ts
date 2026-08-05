import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CONSECUTIVE_FAILURES } from "@/lib/pilot-login-rate-limit";

const originalEnv = { ...process.env };

function loginRequest(password: string) {
  return new Request("http://localhost/api/pilot-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

describe("POST /api/pilot-login", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, PILOT_PASSWORD: "wakayama" };
    // The rate limit counter is module-level state; reload the module fresh so
    // each test starts with an empty counter instead of leaking across tests.
    vi.resetModules();
  });

  it("accepts the correct password immediately", async () => {
    const { POST } = await import("./route");
    const response = await POST(loginRequest("wakayama"));
    expect(response.status).toBe(200);
  });

  it("locks out further attempts after repeated wrong passwords, even with the correct one", async () => {
    const { POST } = await import("./route");

    for (let attempt = 0; attempt < MAX_CONSECUTIVE_FAILURES; attempt += 1) {
      const response = await POST(loginRequest("wrong-password"));
      expect(response.status).toBe(401);
    }

    const lockedOutResponse = await POST(loginRequest("wakayama"));
    expect(lockedOutResponse.status).toBe(429);
    const body = await lockedOutResponse.json() as { message?: string };
    expect(body.message).toContain("しばらく");
  });

  it("does not lock out a user who eventually enters the correct password", async () => {
    const { POST } = await import("./route");

    for (let attempt = 0; attempt < MAX_CONSECUTIVE_FAILURES - 1; attempt += 1) {
      expect((await POST(loginRequest("wrong-password"))).status).toBe(401);
    }

    expect((await POST(loginRequest("wakayama"))).status).toBe(200);
    expect((await POST(loginRequest("wakayama"))).status).toBe(200);
  });

  it("caps a burst of concurrent wrong-password requests at the failure threshold", async () => {
    // Regression test: the rate-limit check must not straddle an `await` boundary, or
    // requests fired in parallel could all read the pre-failure counter and bypass the cap.
    const { POST } = await import("./route");

    const responses = await Promise.all(
      Array.from({ length: MAX_CONSECUTIVE_FAILURES + 3 }, () => POST(loginRequest("wrong-password"))),
    );
    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 401)).toHaveLength(MAX_CONSECUTIVE_FAILURES);
    expect(statuses.filter((status) => status === 429)).toHaveLength(3);
  });
});
