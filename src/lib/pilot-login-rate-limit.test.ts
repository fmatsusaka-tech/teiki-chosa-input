import { describe, expect, it } from "vitest";
import {
  checkPilotLoginRateLimit,
  createPilotLoginRateLimitState,
  LOCKOUT_DURATION_MS,
  MAX_CONSECUTIVE_FAILURES,
  recordPilotLoginFailure,
  recordPilotLoginSuccess,
} from "./pilot-login-rate-limit";

describe("pilot login rate limit", () => {
  it("allows attempts until the consecutive-failure threshold is reached", () => {
    const state = createPilotLoginRateLimitState();
    const now = 1_000_000;

    for (let attempt = 0; attempt < MAX_CONSECUTIVE_FAILURES - 1; attempt += 1) {
      expect(checkPilotLoginRateLimit(state, now)).toEqual({ allowed: true });
      recordPilotLoginFailure(state, now);
    }

    expect(checkPilotLoginRateLimit(state, now)).toEqual({ allowed: true });
  });

  it("locks out further attempts once the threshold is reached", () => {
    const state = createPilotLoginRateLimitState();
    const now = 1_000_000;

    for (let attempt = 0; attempt < MAX_CONSECUTIVE_FAILURES; attempt += 1) {
      recordPilotLoginFailure(state, now);
    }

    expect(checkPilotLoginRateLimit(state, now)).toEqual({
      allowed: false,
      retryAfterMs: LOCKOUT_DURATION_MS,
    });
  });

  it("resets the lockout once the cooldown has elapsed", () => {
    const state = createPilotLoginRateLimitState();
    const now = 1_000_000;
    for (let attempt = 0; attempt < MAX_CONSECUTIVE_FAILURES; attempt += 1) {
      recordPilotLoginFailure(state, now);
    }

    expect(checkPilotLoginRateLimit(state, now + LOCKOUT_DURATION_MS - 1)).toMatchObject({ allowed: false });
    expect(checkPilotLoginRateLimit(state, now + LOCKOUT_DURATION_MS)).toEqual({ allowed: true });
    expect(state.failureCount).toBe(0);
  });

  it("clears the failure count on a successful login", () => {
    const state = createPilotLoginRateLimitState();
    const now = 1_000_000;
    recordPilotLoginFailure(state, now);
    recordPilotLoginFailure(state, now);

    recordPilotLoginSuccess(state);

    expect(state).toEqual({ failureCount: 0, lockedUntil: null });
    expect(checkPilotLoginRateLimit(state, now)).toEqual({ allowed: true });
  });
});
