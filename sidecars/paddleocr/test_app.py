import base64
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app


class PaddleOcrSidecarTest(unittest.TestCase):
    def setUp(self) -> None:
        self.token_patch = patch.dict(os.environ, {"OCR_GATEWAY_TOKEN": "test-token"})
        self.token_patch.start()
        self.client = TestClient(app)
        self.headers = {"Authorization": "Bearer test-token"}

    def tearDown(self) -> None:
        self.token_patch.stop()

    def test_health(self) -> None:
        response = self.client.get("/health", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_exposes_no_documentation_or_other_features(self) -> None:
        self.assertEqual(self.client.get("/docs").status_code, 404)
        self.assertEqual(self.client.get("/openapi.json").status_code, 404)
        self.assertEqual(self.client.get("/").status_code, 404)

    def test_rejects_missing_or_invalid_token(self) -> None:
        self.assertEqual(self.client.get("/health").status_code, 401)
        self.assertEqual(
            self.client.get(
                "/health",
                headers={"Authorization": "Bearer wrong-token"},
            ).status_code,
            401,
        )

    @patch("app.get_ocr")
    def test_ocr_maps_paddle_result(self, get_ocr) -> None:
        get_ocr.return_value.ocr.return_value = [[
            [[[1, 2], [11, 2], [11, 7], [1, 7]], ("糖度 7.3", 0.92)],
        ]]
        response = self.client.post(
            "/ocr",
            headers=self.headers,
            json={
                "imageBase64": base64.b64encode(b"image").decode(),
                "mimeType": "image/png",
                "fileName": "survey.png",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["lines"][0], {
            "text": "糖度 7.3",
            "confidence": 0.92,
            "boundingBox": {"x": 1.0, "y": 2.0, "width": 10.0, "height": 5.0},
        })

    def test_rejects_invalid_image(self) -> None:
        response = self.client.post(
            "/ocr",
            headers=self.headers,
            json={
                "imageBase64": "not-base64",
                "mimeType": "image/png",
            },
        )
        self.assertEqual(response.status_code, 400)

    @patch("app.MAX_IMAGE_BYTES", 4)
    def test_rejects_oversized_image(self) -> None:
        response = self.client.post(
            "/ocr",
            headers=self.headers,
            json={
                "imageBase64": base64.b64encode(b"12345").decode(),
                "mimeType": "image/png",
            },
        )
        self.assertEqual(response.status_code, 413)

    def test_rejects_unsupported_image_type(self) -> None:
        response = self.client.post(
            "/ocr",
            headers=self.headers,
            json={
                "imageBase64": base64.b64encode(b"image").decode(),
                "mimeType": "image/gif",
            },
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()