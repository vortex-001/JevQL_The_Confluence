from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseSemanticProvider(ABC):
    """Abstract base interface for semantic search providers."""

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the semantic provider is configured and reachable."""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the display name of the provider."""
        pass

    @abstractmethod
    def evaluate_candidates(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        timeout_seconds: float = 4.0
    ) -> List[Dict[str, Any]]:
        """
        Evaluate and score shortlisted candidates against the natural-language query.
        Must only return candidate records belonging to the provided candidate list.
        """
        pass

    def generate_query_embedding(self, query: str) -> Any:
        """Generate embedding vector for search query."""
        return None

    def index_records(self, records: List[Any]) -> int:
        """Index records into persistent embedding storage."""
        return 0

