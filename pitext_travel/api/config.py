# api/config.py
"""Configuration management for the travel planner API."""
import os
from dotenv import load_dotenv

load_dotenv()


def get_openai_api_key():
    """Get OpenAI API key from environment."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    return api_key


def get_google_maps_config():
    """Get Google Maps configuration."""
    return {
        "api_key": os.getenv("GOOGLE_MAPS_API_KEY", ""),
        "client_id": os.getenv("maps_client_id", ""),
        "client_secret": os.getenv("maps_client_secret", "")
    }


def get_port():
    """Get port configuration."""
    return int(os.getenv("PORT", 3000))


def get_render_mode():
    """Get render mode configuration."""
    return os.getenv("RENDER_MODE", "html")