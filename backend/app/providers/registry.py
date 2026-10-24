"""Provider registry: resolves a configured name to a concrete adapter.

Unknown/unconfigured providers fall back to a safe mock and log a warning, so the
app always runs offline. Switching providers is a one env-var change.
"""
from __future__ import annotations

import logging
from functools import lru_cache

from app.core.config import settings
from app.providers.llm.base import LLMProvider
from app.providers.llm.mock import MockLLMProvider
from app.providers.ocr.base import OCRProvider
from app.providers.ocr.mock import MockOCRProvider
from app.providers.qr.base import QRDecoder
from app.providers.qr.mock import MockQRDecoder
from app.providers.storage.base import StorageProvider
from app.providers.storage.local import LocalStorageProvider
from app.providers.threatintel.base import ThreatIntelProvider
from app.providers.threatintel.internal import InternalThreatIntelProvider

log = logging.getLogger("cybershield.providers")


@lru_cache
def get_llm_provider() -> LLMProvider:
    name = "mock" if settings.mock_llm else settings.llm_provider
    if name == "mock":
        return MockLLMProvider()
    # openai/anthropic/ollama adapters land in Phase 4; fall back safely for now.
    log.warning("LLM provider '%s' not yet implemented; using mock.", name)
    return MockLLMProvider()


@lru_cache
def get_ocr_provider() -> OCRProvider:
    name = settings.ocr_provider
    if name == "tesseract":
        try:
            from app.providers.ocr.tesseract import TesseractProvider

            return TesseractProvider()
        except Exception as exc:  # pragma: no cover - env-dependent
            log.warning("Tesseract unavailable (%s); using mock OCR.", exc)
            return MockOCRProvider()
    if name != "mock":
        log.warning("OCR provider '%s' not implemented; using mock.", name)
    return MockOCRProvider()


@lru_cache
def get_qr_decoder() -> QRDecoder:
    choice = settings.qr_decoder
    if choice == "mock":
        return MockQRDecoder()
    if choice in ("auto", "opencv"):
        try:
            from app.providers.qr.opencv import OpenCVQRDecoder

            return OpenCVQRDecoder()
        except Exception:
            if choice == "opencv":
                log.warning("OpenCV QR decoder unavailable; using mock.")
            return MockQRDecoder()
    return MockQRDecoder()


@lru_cache
def get_internal_threat_intel_provider() -> ThreatIntelProvider:
    return InternalThreatIntelProvider()


def get_external_threat_intel_providers() -> list[ThreatIntelProvider]:
    """External adapters, only when not mocked and the credential/flag is set.

    Returns empty in dev/test (mock mode) so no network calls happen offline."""
    if settings.mock_threat_intelligence:
        return []
    from app.providers.threatintel.external import (
        OpenPhishProvider,
        PhishTankProvider,
        UrlscanProvider,
        WebRiskProvider,
    )

    providers: list[ThreatIntelProvider] = []
    if settings.google_webrisk_api_key:
        providers.append(WebRiskProvider())
    if settings.phishtank_enabled:
        providers.append(PhishTankProvider())
    if settings.openphish_enabled:
        providers.append(OpenPhishProvider())
    if settings.urlscan_api_key:
        providers.append(UrlscanProvider())
    return providers


@lru_cache
def get_storage_provider() -> StorageProvider:
    name = settings.storage_provider
    if name == "local":
        return LocalStorageProvider()
    log.warning("Storage provider '%s' not yet implemented; using local.", name)
    return LocalStorageProvider()
