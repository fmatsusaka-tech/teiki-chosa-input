import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedBasicHeader, readPilotAuthConfig } from "./src/lib/pilot-auth";

export function middleware(request: NextRequest) {
  const config = readPilotAuthConfig(process.env);
  if (!config) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("試用版のアクセス設定が未完了です。", { status: 503 });
  }
  if (isAuthorizedBasicHeader(request.headers.get("authorization"), config)) {
    return NextResponse.next();
  }
  return new NextResponse("認証が必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AI定期調査システム", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
