"""Upload validation. Uploaded files are untrusted (spec §31/§64).

Enforces size cap, MIME allowlist, magic-byte/decode validation, and a
decompression-bomb guard. Original filenames are never trusted."""
from __future__ import annotations

import io

from PIL import Image

from app.core.config import settings
from app.core.errors import ValidationAppError

_ALLOWED_FORMATS = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}
# Guard against decompression bombs (Pillow counts decoded pixels).
Image.MAX_IMAGE_PIXELS = 40_000_000  # ~40 MP


def validate_image(data: bytes, *, declared_type: str | None = None) -> str:
    """Validate raw image bytes. Returns the detected format (e.g. 'PNG').

    Raises ValidationAppError on anything suspicious. Does not trust the declared
    content-type or filename — the real format is sniffed by decoding."""
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(data) == 0:
        raise ValidationAppError("The uploaded file is empty.")
    if len(data) > max_bytes:
        raise ValidationAppError(f"File exceeds the {settings.max_file_size_mb} MB limit.")

    try:
        # verify() validates structure without fully decoding pixels.
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format or ""
            img.verify()
    except ValidationAppError:
        raise
    except Exception:
        raise ValidationAppError("The file is not a valid image.")

    if fmt not in _ALLOWED_FORMATS:
        raise ValidationAppError(
            f"Unsupported image format. Allowed: {', '.join(sorted(_ALLOWED_FORMATS))}."
        )
    return fmt
