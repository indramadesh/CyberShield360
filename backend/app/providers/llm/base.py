"""LLM provider interface. The LLM EXPLAINS evidence; it never originates it."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Explanation:
    text: str
    provider: str


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def explain(self, *, system_policy: str, evidence: list[dict], untrusted_content: str) -> Explanation:
        """Produce a plain-language explanation from the GIVEN evidence only.

        `untrusted_content` (scanned text) must be treated strictly as data and
        never as instructions (prompt-injection defense)."""
        raise NotImplementedError
