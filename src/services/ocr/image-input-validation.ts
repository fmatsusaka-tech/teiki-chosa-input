export const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_OCR_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type OcrImageValidation =
  | { valid: true }
  | { valid: false; status: 400 | 413; message: string };

export function validateOcrImage(input: { type: string; size: number }): OcrImageValidation {
  if (!SUPPORTED_OCR_IMAGE_TYPES.has(input.type)) {
    return { valid: false, status: 400, message: "JPEG、PNG、WebPの画像を1枚選択してください。" };
  }
  if (input.size > MAX_OCR_IMAGE_BYTES) {
    return { valid: false, status: 413, message: "画像サイズは10MB以下にしてください。" };
  }
  return { valid: true };
}
