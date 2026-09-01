"""
Tests for Step 3's Gemini connection wiring.
"""

import pytest
from unittest.mock import patch

from app.core.gemini_client import gemini_is_configured, get_gemini_client


def test_gemini_is_configured_false_when_key_missing():
    with patch("app.core.gemini_client.settings") as mock_settings:
        mock_settings.gemini_api_key = ""
        assert gemini_is_configured() is False


def test_gemini_is_configured_true_when_key_present():
    with patch("app.core.gemini_client.settings") as mock_settings:
        mock_settings.gemini_api_key = "fake-key-for-test"
        assert gemini_is_configured() is True


def test_get_gemini_client_raises_clear_error_when_unconfigured():
    get_gemini_client.cache_clear()
    with patch("app.core.gemini_client.settings") as mock_settings:
        mock_settings.gemini_api_key = ""
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
            get_gemini_client()
