import { NextResponse } from "next/server";
import {
  createPilotSessionToken,
  PILOT_SESSION_COOKIE,
  readPilotPassword,
  safeEqual,
} from "@/lib/pilot-auth";

export async function POST(request: Request) {
  const configuredPassword = readPilotPassword(process.env);
  if (!configuredPassword) {
    return NextResponse.json(
      { message: "試用版のアクセス設定が未完了です。" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const suppliedPassword = typeof body?.password === "string" ? body.password : "";
  if (!safeEqual(suppliedPassword, configuredPassword)) {
    return NextResponse.json(
      { message: "パスワードが違います。" },
      { status: 401 },
    );
  }

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
