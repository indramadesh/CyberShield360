"""Storage provider interface (local now; S3/cloud later, no logic changes)."""
from __future__ import annotations

from abc import ABC, abstractmethod


class StorageProvider(ABC):
    name: str = "base"

    @abstractmethod
    def save_temp(self, data: bytes, *, suffix: str = "") -> str:
        """Persist to temporary storage, return an opaque key/path."""

    @abstractmethod
    def delete(self, key: str) -> None:
        ...
