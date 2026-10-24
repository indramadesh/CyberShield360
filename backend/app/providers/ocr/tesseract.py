"""Optional Tesseract OCR adapter. Imported lazily so the dependency is only
required when OCR_PROVIDER=tesseract. Falls back cleanly if unavailable."""
from __future__ import annotations

import io

from app.providers.ocr.base import OCRProvider, OCRResult


class TesseractProvider(OCRProvider):
    name = "tesseract"

    def __init__(self) -> None:
        # Lazy import: keeps the package optional.
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401

    def extract_text(self, image_bytes: bytes) -> OCRResult:
        import pytesseract
        from PIL import Image

        with Image.open(io.BytesIO(image_bytes)) as img:
            text = pytesseract.image_to_string(img)
        return OCRResult(text=text or "", provider=self.name)
