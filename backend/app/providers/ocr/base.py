"""OCR provider interface. Uploaded images are untrusted input."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class OCRResult:
    text: str
    provider: str
    meta: dict = field(default_factory=dict)


class OCRProvider(ABC):
    name: str = "base"

    @abstractmethod
    def extract_text(self, image_bytes: bytes) -> OCRResult:
        raise NotImplementedError
