from app.services import pii


def test_detects_common_pii_types():
    text = (
        "Phone 9876543210, email a@b.com, PAN ABCDE1234F, "
        "Aadhaar 1234 5678 9012, UPI john@oksbi"
    )
    found = pii.detect(text)
    assert found.get("PHONE")
    assert found.get("EMAIL")
    assert found.get("PAN")
    assert found.get("AADHAAR")
    assert found.get("UPI")


def test_redaction_removes_raw_values():
    text = "OTP to 9876543210, pay to fraud@okhdfcbank"
    red = pii.redact(text)
    assert "9876543210" not in red
    assert "[REDACTED_PHONE]" in red
    assert "[REDACTED_UPI]" in red
