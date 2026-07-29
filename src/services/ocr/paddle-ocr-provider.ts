import { z } from "zod";
import { OcrProviderError } from "./ocr-error";
import type { OcrProvider } from "./ocr-provider";
import {
  ocrResultSchema,
  type OcrAvailability,
  type OcrInput,
  type OcrMode,
  type OcrResult,
} from "./ocr-types";

const sidecarResponseSchema = z.object({
  lines: z.array(z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1).nullable(),
    boundingBox: z.object({
      x: z.number().nonnegative(),
      y: z.number().nonnegative(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    }).nullable().optional(),
  })),
  elapsedMs: z.number().nonnegative().nullable().optional(),
  model: z.string().nullable().optional(),
});

type Fetch = typeof fetch;

function isLoopbackEndpoint(endpoint: URL): boolean {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(endpoint.hostname);
}

export class PaddleOcrProvider implements OcrProvider {
  readonly name = "paddle" as const;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly mode: OcrMode;
  private readonly fetch: Fetch;
  private readonly token?: string;
  private readonly configurationError?: string;

  constructor(params: {
    endpoint: string;
    timeoutMs: number;
    mode: OcrMode;
    fetch?: Fetch;
    token?: string;
  }) {
    this.endpoint = params.endpoint.replace(/\/$/, "");
    this.timeoutMs = params.timeoutMs;
    this.mode = params.mode;
    this.fetch = params.fetch ?? fetch;
    this.token = params.token?.trim() || undefined;
    const endpoint = new URL(this.endpoint);
    if (!isLoopbackEndpoint(endpoint) && endpoint.protocol !== "https:") {
      this.configurationError = "Remote PaddleOCR endpoints must use HTTPS.";
    } else if (!this.token) {
      this.configurationError = "PADDLE_OCR_TOKEN is not configured.";
    }
  }

  static fromEnvironment(mode: OcrMode, env: Record<string, string | undefined>): PaddleOcrProvider {
    const endpoint = env.PADDLE_OCR_ENDPOINT?.trim() || "http://127.0.0.1:8765";
    const timeoutValue = env.PADDLE_OCR_TIMEOUT_MS?.trim() || "30000";
    const token = env.PADDLE_OCR_TOKEN?.trim();
    const timeoutMs = Number(timeoutValue);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new OcrProviderError({
        code: "INVALID_INPUT",
        provider: "paddle",
        message: `PADDLE_OCR_TIMEOUT_MS must be a positive integer: ${timeoutValue}`,
      });
    }
    try {
      new URL(endpoint);
    } catch (cause) {
      throw new OcrProviderError({
        code: "INVALID_INPUT",
        provider: "paddle",
        message: `PADDLE_OCR_ENDPOINT must be a valid URL: ${endpoint}`,
        cause,
      });
    }
    return new PaddleOcrProvider({ endpoint, timeoutMs, mode, token });
  }

  async checkAvailability(): Promise<OcrAvailability> {
    try {
      const response = await this.request("/health", { method: "GET" });
      if (!response.ok) throw this.responseError(response.status);
      return { available: true };
    } catch (error) {
      return {
        available: false,
        code: "PROVIDER_UNAVAILABLE",
        reason: error instanceof Error ? error.message : "PaddleOCR sidecar is unavailable.",
      };
    }
  }

  async recognize(input: OcrInput): Promise<OcrResult> {
    if (!input.mimeType.startsWith("image/")) {
      throw new OcrProviderError({
        code: "INVALID_INPUT",
        provider: "paddle",
        message: `PaddleOCR requires an image MIME type: ${input.mimeType}`,
      });
    }

    try {
      const bytes = input.image instanceof Uint8Array
        ? input.image
        : new Uint8Array(input.image);
      const response = await this.request("/ocr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: Buffer.from(bytes).toString("base64"),
          mimeType: input.mimeType,
          fileName: input.fileName,
        }),
      });
      if (!response.ok) throw this.responseError(response.status);
      const payload = sidecarResponseSchema.parse(await response.json());
      const lines = payload.lines.map((line) => ({ ...line, metadata: {} }));
      const confidences = lines.flatMap((line) => line.confidence === null ? [] : [line.confidence]);
      return ocrResultSchema.parse({
        provider: "paddle",
        rawText: lines.map((line) => line.text).join("\n"),
        blocks: lines,
        lines,
        confidence: confidences.length
          ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
          : null,
        warnings: [],
        metadata: {
          mode: this.mode,
          processedAt: new Date().toISOString(),
          elapsedMs: payload.elapsedMs,
          model: payload.model,
          rawProvider: "paddleocr-sidecar",
        },
      });
    } catch (cause) {
      if (cause instanceof OcrProviderError) throw cause;
      throw new OcrProviderError({
        code: "PROVIDER_ERROR",
        provider: "paddle",
        message: cause instanceof Error ? cause.message : "PaddleOCR recognition failed.",
        cause,
      });
    }
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    if (this.configurationError) {
      throw new OcrProviderError({
        code: "PROVIDER_UNAVAILABLE",
        provider: "paddle",
        message: this.configurationError,
      });
    }
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.token}`);
    return this.fetch(`${this.endpoint}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  private responseError(status: number): OcrProviderError {
    if (status === 401 || status === 403) {
      return new OcrProviderError({
        code: "PROVIDER_UNAVAILABLE",
        provider: "paddle",
        message: "PaddleOCR gateway authentication failed.",
      });
    }
    if (status >= 500) {
      return new OcrProviderError({
        code: "PROVIDER_UNAVAILABLE",
        provider: "paddle",
        message: `PaddleOCR gateway is unavailable (HTTP ${status}).`,
      });
    }
    return new OcrProviderError({
      code: "PROVIDER_ERROR",
      provider: "paddle",
      message: `PaddleOCR gateway rejected the request (HTTP ${status}).`,
    });
  }
}
