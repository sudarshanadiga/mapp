# core/config.py
"""
Configuration management for PiText CodeGen.
Centralizes all environment variables and configuration settings.
"""

import os
from pathlib import Path
from typing import Optional
from functools import lru_cache
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Application configuration singleton."""
    
    # Paths
    BASE_DIR: Path = Path(__file__).parent.parent
    PROMPTS_DIR: Path = BASE_DIR / "prompts"
    PUBLIC_DIR: Path = BASE_DIR / "public"
    
    # API Settings
    API_PREFIX: str = ""
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", 8000))
    
    # OpenAI Settings
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = "gpt-4.1"
    
    @classmethod
    def validate(cls) -> None:
        """Validate required configuration."""
        if not cls.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required. "
                "Please set it in your .env file or environment."
            )
        
        if not cls.PROMPTS_DIR.exists():
            raise ValueError(f"Prompts directory not found: {cls.PROMPTS_DIR}")
        
        if not cls.PUBLIC_DIR.exists():
            raise ValueError(f"Public directory not found: {cls.PUBLIC_DIR}")

    @classmethod
    def get_prompt_path(cls, filename: str) -> Path:
        """Get the full path to a prompt file."""
        path = cls.PROMPTS_DIR / filename
        if not path.exists():
            raise FileNotFoundError(f"Prompt file not found: {filename}")
        return path

    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production mode."""
        return os.getenv("ENV", "development").lower() == "production"

def get_config() -> type[Config]:
    """Get validated configuration singleton."""
    try:
        Config.validate()
    except ValueError as e:
        # Only raise in production, warn in development
        if Config.is_production():
            raise
        else:
            import warnings
            warnings.warn(f"Configuration warning: {e}")
    return Config

# Validate configuration on module import
try:
    Config.validate()
except ValueError as e:
    import warnings
    warnings.warn(f"Configuration warning: {e}")