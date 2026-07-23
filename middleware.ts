import { NextResponse, type NextRequest } from "next/server";
import {
  createPilotSessionToken,
  PILOT_SESSION_COOKIE,
  readPilotPassword,
  safeEqual,
} from "./src/lib/pilot-auth";

export async function middleware(request: NextRequest) {
  const password = readPilotPassword(process.env);
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("試用版のアクセス設定が未完了です。", { status: 503 });
  }

  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/api/pilot-login") {
    return NextResponse.next();
  }

  const received = request.cookies.get(PILOT_SESSION_COOKIE)?.value ?? "";
  const expected = await createPilotSessionToken(password);
  if (safeEqual(received, expected)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
