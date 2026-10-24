"""QR decoder interface. Decodes a QR image to its raw payload string.

Note: the primary mobile flow decodes QR in the browser (camera) and POSTs the
decoded string directly — this server-side decoder covers image uploads."""
from __future__ import annotations

from abc import ABC, abstractmethod


class QRDecoder(ABC):
    name: str = "base"

    @abstractmethod
    def decode(self, image_bytes: bytes) -> str | None:
        """Return the decoded payload, or None if no QR code was found."""
        raise NotImplementedError
