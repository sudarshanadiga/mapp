"""Configuration module for travel API."""
import os
from typing import Dict, Any


def get_google_maps_config() -> Dict[str, Any]:
    """
    Get Google Maps configuration from environment variables.
    
    Returns:
        Dict containing Google Maps API configuration
    """
    return {
        "api_key": os.getenv("GOOGLE_MAPS_API_KEY", ""),
        "client_id": os.getenv("GOOGLE_MAPS_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_MAPS_CLIENT_SECRET", "")
    }


def get_openai_config() -> Dict[str, Any]:
    """
    Get OpenAI configuration from environment variables.
    
    Returns:
        Dict containing OpenAI API configuration
    """
    return {
        "api_key": os.getenv("OPENAI_API_KEY", ""),
        "model": os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
        "temperature": float(os.getenv("OPENAI_TEMPERATURE", "0.7")),
        "max_tokens": int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
    }


def validate_config() -> Dict[str, bool]:
    """
    Validate that required configuration is present.
    
    Returns:
        Dict indicating which configurations are valid
    """
    return {
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "google_maps_configured": bool(
            os.getenv("GOOGLE_MAPS_API_KEY") or 
            os.getenv("GOOGLE_MAPS_CLIENT_ID")
        ),
        "all_configured": bool(
            os.getenv("OPENAI_API_KEY") and 
            (os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_CLIENT_ID"))
        )
    }