"""Optional OpenCV QR decoder. Lazy import keeps opencv-python optional."""
from __future__ import annotations

import io

from app.providers.qr.base import QRDecoder


class OpenCVQRDecoder(QRDecoder):
    name = "opencv"

    def __init__(self) -> None:
        import cv2  # noqa: F401
        import numpy  # noqa: F401

    def decode(self, image_bytes: bytes) -> str | None:
        import cv2
        import numpy as np
        from PIL import Image

        with Image.open(io.BytesIO(image_bytes)) as img:
            arr = np.array(img.convert("RGB"))[:, :, ::-1]  # RGB->BGR
        detector = cv2.QRCodeDetector()
        data, _, _ = detector.detectAndDecode(arr)
        return data or None
