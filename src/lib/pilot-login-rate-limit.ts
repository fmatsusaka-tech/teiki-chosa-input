/**
 * In-memory brute-force guard for the shared pilot password. State resets on process
 * restart, which is an accepted limitation for this single-instance pilot deployment
 * (see Issue #59) — it is a large improvement over no limit at all, not a distributed
 * rate limiter.
 */
export type PilotLoginRateLimitState = {
  failureCount: number;
  lockedUntil: number | null;
};

export const MAX_CONSECUTIVE_FAILURES = 5;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

export function createPilotLoginRateLimitState(): PilotLoginRateLimitState {
  return { failureCount: 0, lockedUntil: null };
}

export type PilotLoginRateLimitCheck =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/** Call before checking the password. Clears an expired lockout as a side effect. */
export function checkPilotLoginRateLimit(
  state: PilotLoginRateLimitState,
  now: number,
): PilotLoginRateLimitCheck {
  if (state.lockedUntil === null) return { allowed: true };
  if (now < state.lockedUntil) {
    return { allowed: false, retryAfterMs: state.lockedUntil - now };
  }
  state.failureCount = 0;
  state.lockedUntil = null;
  return { allowed: true };
}

export function recordPilotLoginFailure(state: PilotLoginRateLimitState, now: number): void {
  state.failureCount += 1;
  if (state.failureCount >= MAX_CONSECUTIVE_FAILURES) {
    state.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
}

export function recordPilotLoginSuccess(state: PilotLoginRateLimitState): void {
  state.failureCount = 0;
  state.lockedUntil = null;
}
