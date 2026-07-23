import { describe, expect, it } from "vitest";
import { isAuthorizedBasicHeader, readPilotAuthConfig } from "./pilot-auth";

describe("pilot auth", () => {
  it("requires both server-side credentials", () => {
    expect(readPilotAuthConfig({ PILOT_USERNAME: "tester" })).toBeNull();
    expect(readPilotAuthConfig({ PILOT_USERNAME: " tester ", PILOT_PASSWORD: "secret" }))
      .toEqual({ username: "tester", password: "secret" });
  });

  it("accepts only an exact Basic credential pair", () => {
    const config = { username: "tester", password: "secret:with-colon" };
    const valid = `Basic ${btoa("tester:secret:with-colon")}`;
    expect(isAuthorizedBasicHeader(valid, config)).toBe(true);
    expect(isAuthorizedBasicHeader(`Basic ${btoa("tester:wrong")}`, config)).toBe(false);
    expect(isAuthorizedBasicHeader(null, config)).toBe(false);
    expect(isAuthorizedBasicHeader("Bearer token", config)).toBe(false);
  });
});
