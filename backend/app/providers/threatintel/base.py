"""Threat-intelligence provider interface.

Each provider is isolated: a failure degrades coverage but never fails the scan.
Results carry provider + confidence so the risk engine can weigh them.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class IntelMatch:
    provider: str
    indicator: str
    indicator_type: str  # url | domain | ip | hash | phone | upi | email
    threat_type: str
    confidence: float  # 0..1
    source_url: str | None = None


@dataclass
class IntelLookup:
    matches: list[IntelMatch]
    provider: str
    available: bool  # False => provider was unavailable; coverage is degraded


class ThreatIntelProvider(ABC):
    name: str = "base"

    @abstractmethod
    def lookup(self, indicator: str, indicator_type: str) -> IntelLookup:
        raise NotImplementedError
