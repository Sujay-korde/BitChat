from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ModerationResult:
    allowed: bool
    score: float
    reason: str | None = None


class ModerationClassifier:
    def __init__(self, threshold: float = 0.65) -> None:
        self.threshold = threshold
        self._blocked_terms = {
            "hate",
            "kill",
            "idiot",
            "stupid",
            "trash",
            "dumb",
        }

    def score(self, text: str) -> float:
        normalized = text.lower()
        hits = sum(1 for term in self._blocked_terms if term in normalized)
        if not normalized.strip():
            return 0.0
        return min(1.0, hits * 0.25 + (0.15 if len(normalized) > 240 else 0.0))

    def moderate(self, text: str) -> ModerationResult:
        score = self.score(text)
        if score >= self.threshold:
            return ModerationResult(allowed=False, score=score, reason="Potentially toxic content detected")
        return ModerationResult(allowed=True, score=score)
