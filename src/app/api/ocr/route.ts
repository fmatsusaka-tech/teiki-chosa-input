import { NextResponse } from "next/server";
import { createOcrProvider, normalizeOcrError, ocrUserMessage } from "../../../services/ocr";
import { validateOcrImage } from "../../../services/ocr/image-input-validation";
import { RuleBasedOcrParser } from "../../../services/ocr-parser";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "読み取る画像を1枚選択してください。" }, { status: 400 });
    }
    const validation = validateOcrImage(image);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.message }, { status: validation.status });
    }
    const provider = createOcrProvider();
    const ocrResult = await provider.recognize({
      image: await image.arrayBuffer(), mimeType: image.type, fileName: image.name,
      sourceKind: form.get("sourceKind") === "photo" ? "photo" : "screenshot",
    });
    const parsed = await new RuleBasedOcrParser().parse({ ocrResult });
    return NextResponse.json(parsed);
  } catch (error) {
    const normalized = normalizeOcrError(error);
    return NextResponse.json(
      { error: ocrUserMessage(normalized), code: normalized.code },
      { status: normalized.code === "INVALID_INPUT" ? 400 : 503 },
    );
  }
}
