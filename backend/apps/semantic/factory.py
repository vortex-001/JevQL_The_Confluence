from .base import BaseSemanticProvider
from .gemini_provider import GeminiSemanticProvider
from .fallback_provider import FallbackSemanticProvider

def get_semantic_provider() -> BaseSemanticProvider:
    """
    Returns the appropriate semantic provider based on configuration.
    Falls back gracefully if the Gemini API key is missing or disabled.
    """
    gemini = GeminiSemanticProvider()
    if gemini.is_available():
        return gemini
    return FallbackSemanticProvider()
