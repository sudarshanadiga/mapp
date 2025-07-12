# services/llm/prompts.py
"""
Prompt template management for CodeGen LLM operations.
"""

from pathlib import Path
from typing import Dict
from functools import lru_cache
import logging

from pitext_codegen.core.config import get_config

logger = logging.getLogger(__name__)


class PromptManager:
    """Manages loading and caching of prompt templates."""
    
    PROMPT_FILES = {
        "mermaid": "mermaid_generator.txt",
        "mermaid_generator": "mermaid_generator.txt",
        "code": "code_generator.txt",
        "deepdive": "deepdive.txt",
    }
    
    def __init__(self):
        self.config = get_config()
        self._cache: Dict[str, str] = {}
        logger.info(f"PromptManager initialized with config: {self.config}")
        logger.info(f"PROMPTS_DIR: {self.config.PROMPTS_DIR}")
        logger.info(f"Available prompt files: {list(self.PROMPT_FILES.keys())}")
        self._load_all_prompts()
    
    def _load_all_prompts(self):
        """Pre-load all known prompts for validation."""
        for key in self.PROMPT_FILES:
            try:
                self.get(key)
                logger.info(f"Successfully loaded prompt '{key}'")
            except Exception as e:
                logger.warning(f"Failed to load prompt '{key}': {e}")
    
    def get(self, key: str) -> str:
        """
        Get a prompt template by key.
        
        Args:
            key: Prompt identifier (e.g., "mermaid", "code")
            
        Returns:
            The prompt content string.
            
        Raises:
            KeyError: If prompt not found
        """
        logger.debug(f"Getting prompt for key: '{key}'")
        logger.debug(f"Available keys: {list(self.PROMPT_FILES.keys())}")
        
        if key not in self._cache:
            if key not in self.PROMPT_FILES:
                logger.error(f"Unknown prompt key: '{key}'. Available keys: {list(self.PROMPT_FILES.keys())}")
                raise KeyError(f"Unknown prompt key: '{key}'")
            
            filename = self.PROMPT_FILES[key]
            path = self.config.get_prompt_path(filename)
            logger.debug(f"Loading prompt from path: {path}")
            content = path.read_text(encoding="utf-8")
            self._cache[key] = content
            logger.debug(f"Loaded prompt '{key}' from {filename}")
        
        return self._cache[key]

@lru_cache()
def get_prompt_manager() -> PromptManager:
    """Get singleton PromptManager instance."""
    return PromptManager()