from tests.helpers import make_png


def test_image_scan_with_ocr_text_is_elevated(client):
    png = make_png(ocr_text=(
        "URGENT: KYC pending. Verify your OTP now at "
        "http://secure-login-verify.example/login"
    ))
    r = client.post(
        "/api/v1/scans/upload",
        files={"file": ("screenshot.png", png, "image/png")},
        data={"scan_type": "IMAGE"},
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["scan_type"] == "IMAGE"
    assert data["risk_level"] in {"HIGH", "CRITICAL"}


def test_image_scan_without_text_is_low(client):
    png = make_png()  # no ocr_text chunk
    r = client.post(
        "/api/v1/scans/upload",
        files={"file": ("photo.png", png, "image/png")},
        data={"scan_type": "IMAGE"},
    )
    data = r.json()["data"]
    assert data["risk_level"] == "LOW"


def test_non_image_upload_is_rejected(client):
    r = client.post(
        "/api/v1/scans/upload",
        files={"file": ("evil.png", b"this is not an image", "image/png")},
        data={"scan_type": "IMAGE"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_INPUT"


def test_qr_image_upload_decodes_and_analyzes(client):
    png = make_png(qr_payload="http://secure-login-verify.example/login")
    r = client.post(
        "/api/v1/scans/upload",
        files={"file": ("qr.png", png, "image/png")},
        data={"scan_type": "QR"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["risk_level"] in {"HIGH", "CRITICAL"}


def test_qr_payload_json_unknown_upi_is_not_critical(client):
    r = client.post("/api/v1/scans", json={
        "type": "QR",
        "payload": "upi://pay?pa=stranger@oksbi&pn=Someone&am=500&cu=INR",
    })
    data = r.json()["data"]
    assert data["risk_level"] in {"LOW", "SUSPICIOUS"}  # unknown != malicious


def test_email_scan_json_is_elevated(client):
    raw = (
        "From: Support <support@yourbank.com>\n"
        "Reply-To: recover@totally-different.example\n\n"
        "Verify your OTP at http://secure-login-verify.example/login now."
    )
    r = client.post("/api/v1/scans", json={"type": "EMAIL", "payload": raw})
    data = r.json()["data"]
    assert data["risk_level"] in {"SUSPICIOUS", "HIGH", "CRITICAL"}


def test_image_type_rejected_on_json_endpoint(client):
    r = client.post("/api/v1/scans", json={"type": "IMAGE", "payload": "x"})
    assert r.status_code == 422
