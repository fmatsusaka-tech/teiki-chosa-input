import { describe, expect, it } from "vitest";
import {
  createPilotSessionToken,
  isPublicPilotPath,
  readPilotPassword,
  safeEqual,
} from "./pilot-auth";

describe("pilot auth", () => {
  it("keeps login routes public with or without a trailing slash", () => {
    expect(isPublicPilotPath("/login")).toBe(true);
    expect(isPublicPilotPath("/login/")).toBe(true);
    expect(isPublicPilotPath("/api/pilot-login")).toBe(true);
    expect(isPublicPilotPath("/api/pilot-login/")).toBe(true);
    expect(isPublicPilotPath("/api/health")).toBe(true);
    expect(isPublicPilotPath("/api/health/")).toBe(true);
    expect(isPublicPilotPath("/")).toBe(false);
    expect(isPublicPilotPath("/api/survey-records/")).toBe(false);
  });

  it("requires only a password", () => {
    expect(readPilotPassword({})).toBeNull();
    expect(readPilotPassword({ PILOT_PASSWORD: "wakayama" })).toBe("wakayama");
  });

  it("creates stable tokens without exposing the password", async () => {
    const token = await createPilotSessionToken("secret");
    expect(token).toHaveLength(64);
    expect(token).toBe(await createPilotSessionToken("secret"));
    expect(token).not.toContain("secret");
    expect(token).not.toBe(await createPilotSessionToken("other"));
  });

  it("compares session values exactly", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "nope")).toBe(false);
    expect(safeEqual("short", "longer")).toBe(false);
  });
});
