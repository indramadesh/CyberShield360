"""Offline OCR mock.

Reads text from a PNG `tEXt` chunk named `ocr_text` if present. This makes the
image pipeline deterministically testable offline (Pillow is always available)
and lets DEMO screenshots carry their own text. Real engines (Tesseract/EasyOCR)
implement the same interface and actually read pixels."""
from __future__ import annotations

import io

from PIL import Image

from app.providers.ocr.base import OCRProvider, OCRResult


class MockOCRProvider(OCRProvider):
    name = "mock"

    def extract_text(self, image_bytes: bytes) -> OCRResult:
        text = ""
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                # PNG text chunks surface in img.info / img.text.
                text = (getattr(img, "text", {}) or {}).get("ocr_text", "") \
                    or (img.info or {}).get("ocr_text", "")
        except Exception:
            text = ""
        return OCRResult(text=text, provider=self.name, meta={"bytes": len(image_bytes)})
