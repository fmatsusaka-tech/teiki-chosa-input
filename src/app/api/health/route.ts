import { NextResponse } from "next/server";
import { createOcrProvider } from "../../../services/ocr";

export async function GET() {
  const ocr = await createOcrProvider().checkAvailability();
  return NextResponse.json({
    ok: true,
    app: "ok",
    ocr: ocr.available ? "ok" : "unavailable",
  });
}
