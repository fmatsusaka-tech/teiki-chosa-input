import { NextResponse } from "next/server";
import { createOcrProvider } from "../../../services/ocr";

export async function GET() {
  const ocr = await createOcrProvider().checkAvailability();
  return NextResponse.json(
    { ok: ocr.available, app: "ok", ocr: ocr.available ? "ok" : "unavailable" },
    { status: ocr.available ? 200 : 503 },
  );
}
