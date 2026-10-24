"""Uploaded files are untrusted: validate by decoding, not by filename/mime."""
from app.services import uploads
from app.core.errors import ValidationAppError
from tests.helpers import make_png
import pytest


def test_rejects_non_image_bytes():
    with pytest.raises(ValidationAppError):
        uploads.validate_image(b"GIF89a-but-truncated-garbage")


def test_rejects_empty():
    with pytest.raises(ValidationAppError):
        uploads.validate_image(b"")


def test_accepts_valid_png_regardless_of_claimed_type():
    # A real PNG passes even if the client lied about content-type elsewhere.
    assert uploads.validate_image(make_png(), declared_type="text/plain") == "PNG"


def test_api_rejects_disguised_file(client):
    # Bytes claim to be a png by filename/mime but are not a valid image.
    r = client.post(
        "/api/v1/scans/upload",
        files={"file": ("photo.png", b"<html>not an image</html>", "image/png")},
        data={"scan_type": "IMAGE"},
    )
    assert r.status_code == 422
