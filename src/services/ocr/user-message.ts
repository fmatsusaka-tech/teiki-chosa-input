import type { OcrProviderError } from "./ocr-error";

export function ocrUserMessage(error: OcrProviderError): string {
  if (error.code === "INVALID_INPUT") {
    return "画像を読み取れませんでした。JPEG、PNG、WebPの画像を確認してください。";
  }
  if (error.code === "PROVIDER_UNAVAILABLE") {
    return "OCR機能は現在利用できません。文章入力と登録は引き続き利用できます。";
  }
  return "OCRで画像を読み取れませんでした。時間をおいて再試行してください。";
}