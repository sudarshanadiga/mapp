# core/config.py
"""
Configuration management for PiText Desktop.
Centralizes all environment variables and configuration settings.
"""

import os
from pathlib import Path
from typing import Optional, Literal
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
    API_PREFIX: str = "/desktop"
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", 3000))
    
    # OpenAI Settings
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = "gpt-4.1"
    OPENAI_TEMPERATURE: float = 0.7
    OPENAI_MAX_TOKENS_CONTENT: int = 500
    OPENAI_MAX_TOKENS_DIAGRAM: int = 1500
    OPENAI_MAX_TOKENS_SELECTOR: int = 5
    
    # Rendering Settings
    RENDER_MODE: Literal["html", "image"] = os.getenv("RENDER_MODE", "html").lower()  # type: ignore
    
    # Playwright Settings (for image rendering)
    PLAYWRIGHT_TIMEOUT: int = 10000  # ms
    PLAYWRIGHT_ARGS: list[str] = ['--no-sandbox', '--disable-setuid-sandbox']
    
    # CORS Settings
    CORS_ORIGINS: list[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "%(asctime)s [%(levelname)s] %(message)s"
    
    @classmethod
    def validate(cls) -> None:
        """Validate required configuration."""
        if not cls.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY environment variable is required. "
                "Please set it in your .env file or environment."
            )
        
        if cls.RENDER_MODE not in ("html", "image"):
            raise ValueError(
                f"Invalid RENDER_MODE: {cls.RENDER_MODE}. "
                "Must be either 'html' or 'image'."
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
    def is_development(cls) -> bool:
        """Check if running in development mode."""
        return os.getenv("ENV", "development").lower() == "development"
    
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
    # Only raise in production, warn in development
    if Config.is_production():
        raise
    else:
        import warnings
        warnings.warn(f"Configuration warning: {e}")
