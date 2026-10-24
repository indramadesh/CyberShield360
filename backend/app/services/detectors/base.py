"""Detector interface. A detector analyzes one modality and emits signals only."""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.engine.signals import DetectionResult


class Detector(ABC):
    scan_type: str = "base"

    @abstractmethod
    def analyze(self, payload: str) -> DetectionResult:
        raise NotImplementedError
