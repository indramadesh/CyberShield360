"""Offline QR decoder mock: reads the payload from a PNG `qr_payload` text chunk.
Keeps the QR image path testable offline. A real OpenCV/pyzbar adapter reads pixels."""
from __future__ import annotations

import io

from PIL import Image

from app.providers.qr.base import QRDecoder


class MockQRDecoder(QRDecoder):
    name = "mock"

    def decode(self, image_bytes: bytes) -> str | None:
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                payload = (getattr(img, "text", {}) or {}).get("qr_payload") \
                    or (img.info or {}).get("qr_payload")
                return payload or None
        except Exception:
            return None
