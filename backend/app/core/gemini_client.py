"""
Gemini client for the backend — this is what actually calls the Gemini
API to run each agent's reasoning.

Uses the current Google Gen AI SDK (`google-genai`), not the older
`google-generativeai` package, which Google deprecated in late 2025.
"""

from functools import lru_cache
from google import genai

from app.core.config import settings


def gemini_is_configured() -> bool:
    return bool(settings.gemini_api_key)


@lru_cache
def get_gemini_client() -> genai.Client:
    if not gemini_is_configured():
        raise RuntimeError(
            "Gemini is not configured. Set GEMINI_API_KEY in your .env file. "
            "Get a free key at https://aistudio.google.com/apikey — no credit "
            "card required for the free tier."
        )
    return genai.Client(api_key=settings.gemini_api_key)
