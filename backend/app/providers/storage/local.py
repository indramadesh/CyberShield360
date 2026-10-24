"""Local temp storage with random filenames (never trusts original names)."""
from __future__ import annotations

import uuid
from pathlib import Path

from app.core.config import settings
from app.providers.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    name = "local"

    def __init__(self) -> None:
        self.root = Path(settings.storage_local_path)
        self.root.mkdir(parents=True, exist_ok=True)

    def save_temp(self, data: bytes, *, suffix: str = "") -> str:
        key = f"{uuid.uuid4().hex}{suffix}"
        (self.root / key).write_bytes(data)
        return key

    def delete(self, key: str) -> None:
        target = self.root / key
        if target.exists():
            target.unlink()
