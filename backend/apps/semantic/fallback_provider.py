from typing import List, Dict, Any
from .base import BaseSemanticProvider

class FallbackSemanticProvider(BaseSemanticProvider):
    """
    Standard local fallback provider.
    Ranks candidates using PostgreSQL trigram similarity / token overlap scores.
    Guarantees the system works 100% offline without any external API keys.
    Transparently informs the user that keyword matching is active.
    """

    def is_available(self) -> bool:
        return True

    def get_provider_name(self) -> str:
        return "PostgreSQL Trigram Search (Semantic AI Offline)"

    def evaluate_candidates(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        timeout_seconds: float = 4.0
    ) -> List[Dict[str, Any]]:
        # Sort by similarity descending, preserving database ordering
        sorted_candidates = sorted(
            candidates,
            key=lambda c: c.get('similarity_score', 0.0),
            reverse=True
        )
        for c in sorted_candidates:
            c['semantic_provider'] = self.get_provider_name()
            score = c.get('similarity_score', 0.0)
            if 'relevance_explanation' not in c:
                if score > 0:
                    c['relevance_explanation'] = f"PostgreSQL trigram keyword match (Score: {score:.2f}) — Semantic search offline"
                else:
                    c['relevance_explanation'] = "Structured filter match (Chronological order) — Semantic search offline"
        return sorted_candidates
