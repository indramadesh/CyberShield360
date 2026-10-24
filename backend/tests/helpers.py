"""Test helpers: build small PNGs carrying text chunks that the offline OCR/QR
mocks read (ocr_text / qr_payload). Keeps the multi-modal pipeline testable."""
from __future__ import annotations

import io

from PIL import Image
from PIL.PngImagePlugin import PngInfo


def make_png(**text_chunks: str) -> bytes:
    img = Image.new("RGB", (64, 64), "white")
    meta = PngInfo()
    for key, value in text_chunks.items():
        meta.add_text(key, value)
    buf = io.BytesIO()
    img.save(buf, "PNG", pnginfo=meta)
    return buf.getvalue()
