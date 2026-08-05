import { NextResponse } from "next/server";
import {
  createPilotSessionToken,
  PILOT_SESSION_COOKIE,
  readPilotPassword,
  safeEqual,
} from "@/lib/pilot-auth";
import {
  checkPilotLoginRateLimit,
  createPilotLoginRateLimitState,
  recordPilotLoginFailure,
  recordPilotLoginSuccess,
} from "@/lib/pilot-login-rate-limit";

// Module-level: one counter per running server process. Acceptable for this
// single-instance pilot deployment (see Issue #59).
const rateLimitState = createPilotLoginRateLimitState();

export async function POST(request: Request) {
  const configuredPassword = readPilotPassword(process.env);
  if (!configuredPassword) {
    return NextResponse.json(
      { message: "試用版のアクセス設定が未完了です。" },
      { status: 503 },
    );
  }

  const rateLimit = checkPilotLoginRateLimit(rateLimitState, Date.now());
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "ログイン試行が多すぎます。しばらく時間をおいてから再試行してください。" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const suppliedPassword = typeof body?.password === "string" ? body.password : "";
  if (!safeEqual(suppliedPassword, configuredPassword)) {
    recordPilotLoginFailure(rateLimitState, Date.now());
    return NextResponse.json(
      { message: "パスワードが違います。" },
      { status: 401 },
    );
  }

  recordPilotLoginSuccess(rateLimitState);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: PILOT_SESSION_COOKIE,
    value: await createPilotSessionToken(configuredPassword),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
