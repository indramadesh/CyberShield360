"""Deterministic, offline LLM. Explains only the evidence it is handed, with
neutral wording that never overstates risk (a LOW result must not read as if it
'shows signs of risk'). Instructions embedded in scanned content are ignored."""
from __future__ import annotations

from app.providers.llm.base import Explanation, LLMProvider


class MockLLMProvider(LLMProvider):
    name = "mock"

    def explain(self, *, system_policy: str, evidence: list[dict], untrusted_content: str) -> Explanation:
        # Only signals that actually contribute to the score are "findings";
        # zero-weight entries are context (e.g. page title) and are not risk.
        findings = [e for e in evidence if (e.get("weight") or 0) > 0]
        if not findings:
            text = (
                "No notable risk indicators were found in the analyzed content. "
                "This is not a guarantee of safety — stay cautious."
            )
        else:
            reasons = "; ".join(e.get("summary", e.get("indicator", "signal")) for e in findings[:5])
            text = (
                "The analysis surfaced the following indicators: "
                f"{reasons}. See the risk rating and recommended actions above."
            )
        return Explanation(text=text, provider=self.name)
