import { describe, expect, it, vi } from "vitest";
import { PaddleOcrProvider } from "./paddle-ocr-provider";

describe("PaddleOcrProvider", () => {
  it("maps sidecar lines to the common OCR result and sends the gateway token", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
      lines: [
        { text: "ゆら早生", confidence: 0.9, boundingBox: { x: 1, y: 2, width: 30, height: 10 } },
        { text: "糖度 7.3", confidence: null },
      ],
      elapsedMs: 25,
      model: "PP-OCRv4",
    }), { status: 200 }));
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765/",
      timeoutMs: 1000,
      mode: "economy",
      fetch,
      token: "secret-token",
    });

    const result = await provider.recognize({
      image: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      fileName: "survey.png",
    });

    expect(result.rawText).toBe("ゆら早生\n糖度 7.3");
    expect(result.confidence).toBe(0.9);
    expect(result.lines[0]?.boundingBox).toEqual({ x: 1, y: 2, width: 30, height: 10 });
    expect(fetch).toHaveBeenCalledWith("http://localhost:8765/ocr", expect.objectContaining({
      method: "POST",
      headers: expect.any(Headers),
    }));
    const requestHeaders = fetch.mock.calls[0]?.[1]?.headers as Headers;
    expect(requestHeaders.get("authorization")).toBe("Bearer secret-token");
  });

  it("reports an unavailable sidecar without throwing", async () => {
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765",
      timeoutMs: 1000,
      mode: "economy",
      fetch: vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("connection refused")),
      token: "secret-token",
    });

    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      code: "PROVIDER_UNAVAILABLE",
      reason: "connection refused",
    });
  });

  it("normalizes malformed sidecar output as a provider error", async () => {
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765",
      timeoutMs: 1000,
      mode: "economy",
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(JSON.stringify({ lines: [{ text: "invalid", confidence: 2 }] })),
      ),
      token: "secret-token",
    });

    await expect(provider.recognize({
      image: new Uint8Array([1]),
      mimeType: "image/jpeg",
    })).rejects.toMatchObject({ code: "PROVIDER_ERROR", provider: "paddle" });
  });

  it("rejects non-image input and unknown timeout settings", async () => {
    const provider = new PaddleOcrProvider({
      endpoint: "http://localhost:8765",
      timeoutMs: 1000,
      mode: "economy",
      token: "secret-token",
    });
    await expect(provider.recognize({
      image: new Uint8Array(),
      mimeType: "application/pdf",
    })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(() => PaddleOcrProvider.fromEnvironment("economy", {
      PADDLE_OCR_TIMEOUT_MS: "unknown",
    })).toThrow(/positive integer/);
  });

  it("reports missing tokens and insecure remote endpoints as unavailable", async () => {
    const missingToken = new PaddleOcrProvider({
      endpoint: "https://ocr.example.com",
      timeoutMs: 1000,
      mode: "economy",
      fetch: vi.fn<typeof globalThis.fetch>(),
    });
    await expect(missingToken.checkAvailability()).resolves.toMatchObject({
      available: false,
      code: "PROVIDER_UNAVAILABLE",
      reason: "PADDLE_OCR_TOKEN is not configured.",
    });

    const insecureRemote = new PaddleOcrProvider({
      endpoint: "http://ocr.example.com",
      timeoutMs: 1000,
      mode: "economy",
      token: "secret-token",
      fetch: vi.fn<typeof globalThis.fetch>(),
    });
    await expect(insecureRemote.checkAvailability()).resolves.toMatchObject({
      available: false,
      code: "PROVIDER_UNAVAILABLE",
      reason: "Remote PaddleOCR endpoints must use HTTPS.",
    });
  });

  it("normalizes gateway authentication failures as unavailable", async () => {
    const provider = new PaddleOcrProvider({
      endpoint: "https://ocr.example.com",
      timeoutMs: 1000,
      mode: "economy",
      token: "wrong-token",
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(null, { status: 401 }),
      ),
    });

    await expect(provider.recognize({
      image: new Uint8Array([1]),
      mimeType: "image/png",
    })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      provider: "paddle",
    });
  });
});