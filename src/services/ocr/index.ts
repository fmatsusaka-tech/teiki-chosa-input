export { createOcrRuntimeConfig } from "./config";
export { createOcrProvider, createOcrProviderSelection } from "./factory";
export { OcrProviderError, normalizeOcrError } from "./ocr-error";
export type { OcrProvider } from "./ocr-provider";
export { PaddleOcrProvider } from "./paddle-ocr-provider";
export { OcrProviderRegistry, createDefaultOcrProviderRegistry } from "./provider-registry";
export { StaticOcrProvider } from "./static-provider";
export { UnimplementedOcrProvider } from "./unimplemented-provider";
export type {
  OcrAvailability,
  OcrBoundingBox,
  OcrErrorCode,
  OcrInput,
  OcrMetadata,
  OcrMode,
  OcrProviderName,
  OcrResult,
  OcrRuntimeConfig,
  OcrTextBlock,
} from "./ocr-types";
export { ocrResultSchema, ocrTextBlockSchema } from "./ocr-types";
export { ocrUserMessage } from "./user-message";
