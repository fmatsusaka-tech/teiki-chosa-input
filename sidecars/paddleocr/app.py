import base64
import binascii
import os
import secrets
import tempfile
import time
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(
    title="PaddleOCR sidecar",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
_ocr: Any | None = None
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
IMAGE_SUFFIX_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


class OcrRequest(BaseModel):
    imageBase64: str
    mimeType: str
    fileName: str | None = None


def get_ocr() -> Any:
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR

        _ocr = PaddleOCR(use_angle_cls=True, lang=os.getenv("PADDLE_OCR_LANG", "japan"), show_log=False)
    return _ocr


def require_gateway_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    expected_token = os.getenv("OCR_GATEWAY_TOKEN", "").strip()
    if not expected_token:
        raise HTTPException(status_code=503, detail="OCR gateway is not configured")
    scheme, _, supplied_token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(
        supplied_token,
        expected_token,
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health", dependencies=[Depends(require_gateway_token)])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr", dependencies=[Depends(require_gateway_token)])
def recognize(request: OcrRequest) -> dict[str, Any]:
    if request.mimeType not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="unsupported image type")
    try:
        image = base64.b64decode(request.imageBase64, validate=True)
    except (ValueError, binascii.Error) as error:
        raise HTTPException(status_code=400, detail="imageBase64 is invalid") from error
    if not image:
        raise HTTPException(status_code=400, detail="image is empty")
    if len(image) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image exceeds 10MB")

    suffix = IMAGE_SUFFIX_BY_TYPE[request.mimeType]
    started = time.perf_counter()
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix) as image_file:
            image_file.write(image)
            image_file.flush()
            result = get_ocr().ocr(image_file.name, cls=True)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"PaddleOCR failed: {error}") from error

    lines = []
    for page in result or []:
        for item in page or []:
            points, recognition = item
            text, confidence = recognition
            xs = [float(point[0]) for point in points]
            ys = [float(point[1]) for point in points]
            lines.append({
                "text": str(text),
                "confidence": float(confidence) if confidence is not None else None,
                "boundingBox": {
                    "x": min(xs),
                    "y": min(ys),
                    "width": max(xs) - min(xs),
                    "height": max(ys) - min(ys),
                },
            })
    return {
        "lines": lines,
        "elapsedMs": round((time.perf_counter() - started) * 1000, 3),
        "model": "PaddleOCR",
    }
