# services/llm/prompts.py
"""
Prompt template management for LLM operations.
Handles loading, caching, and formatting of prompt templates.
"""

from pathlib import Path
from typing import Dict, Optional
from functools import lru_cache
import logging

from core.config import get_config


logger = logging.getLogger(__name__)


class PromptTemplate:
    """Represents a loaded prompt template with metadata."""
    
    def __init__(self, name: str, content: str, path: Path):
        self.name = name
        self.content = content
        self.path = path
        self._validate()
    
    def _validate(self):
        """Validate prompt content."""
        if not self.content.strip():
            raise ValueError(f"Prompt template '{self.name}' is empty")
    
    def format(self, **kwargs) -> str:
        """
        Format the prompt with provided variables.
        
        Args:
            **kwargs: Variables to substitute in the template
            
        Returns:
            Formatted prompt string
        """
        try:
            return self.content.format(**kwargs)
        except KeyError as e:
            logger.error(f"Missing variable in prompt '{self.name}': {e}")
            raise ValueError(f"Missing required variable: {e}")
    
    def __str__(self) -> str:
        return self.content


class PromptManager:
    """Manages loading and caching of prompt templates."""
    
    # Prompt filename mapping
    PROMPT_FILES = {
        # Content generation
        "content": "content.txt",
        "content_sequence": "content_sequence_comparison.txt",
        
        # Diagram generation
        "diagram_radial": "diagram.txt",
        "diagram_flowchart": "diagram_flowchart.txt",
        "diagram_sequence": "diagram_sequence_comparison.txt",
        
        # Other
        "deep_dive": "deep_dive.txt",
    }
    
    def __init__(self):
        self.config = get_config()
        self._cache: Dict[str, PromptTemplate] = {}
        self._load_all_prompts()
    
    def _load_all_prompts(self):
        """Pre-load all known prompts for validation."""
        for key, filename in self.PROMPT_FILES.items():
            try:
                self._load_prompt(key, filename)
            except Exception as e:
                logger.warning(f"Failed to load prompt '{key}': {e}")
    
    def _load_prompt(self, key: str, filename: str) -> PromptTemplate:
        """Load a single prompt file."""
        path = self.config.get_prompt_path(filename)
        content = path.read_text(encoding="utf-8")
        
        template = PromptTemplate(
            name=key,
            content=content,
            path=path
        )
        
        self._cache[key] = template
        logger.debug(f"Loaded prompt '{key}' from {filename}")
        return template
    
    def get(self, key: str) -> PromptTemplate:
        """
        Get a prompt template by key.
        
        Args:
            key: Prompt identifier
            
        Returns:
            PromptTemplate instance
            
        Raises:
            KeyError: If prompt not found
        """
        if key not in self._cache:
            if key not in self.PROMPT_FILES:
                raise KeyError(f"Unknown prompt key: '{key}'")
            
            # Try to load if not in cache
            self._load_prompt(key, self.PROMPT_FILES[key])
        
        return self._cache[key]
    
    def get_content_prompt(self, diagram_type: str) -> PromptTemplate:
        """
        Get the appropriate content generation prompt for a diagram type.
        
        Args:
            diagram_type: Type of diagram (flowchart, radial_mindmap, sequence_comparison)
            
        Returns:
            Appropriate content prompt template
        """
        if diagram_type == "sequence_comparison":
            return self.get("content_sequence")
        return self.get("content")
    
    def get_diagram_prompt(self, diagram_type: str) -> PromptTemplate:
        """
        Get the appropriate diagram generation prompt for a diagram type.
        
        Args:
            diagram_type: Type of diagram
            
        Returns:
            Appropriate diagram prompt template
        """
        prompt_map = {
            "flowchart": "diagram_flowchart",
            "radial_mindmap": "diagram_radial",
            "sequence_comparison": "diagram_sequence",
        }
        
        key = prompt_map.get(diagram_type, "diagram_radial")
        return self.get(key)
    
    def reload(self, key: Optional[str] = None):
        """
        Reload prompt(s) from disk.
        
        Args:
            key: Specific prompt to reload, or None for all
        """
        if key:
            if key in self.PROMPT_FILES:
                self._load_prompt(key, self.PROMPT_FILES[key])
                logger.info(f"Reloaded prompt '{key}'")
        else:
            self._cache.clear()
            self._load_all_prompts()
            logger.info("Reloaded all prompts")


@lru_cache()
def get_prompt_manager() -> PromptManager:
    """Get singleton PromptManager instance."""
    return PromptManager()


def load_prompt(key: str) -> str:
    """
    Convenience function to load a prompt by key.
    
    Args:
        key: Prompt identifier
        
    Returns:
        Prompt content string
    """
    manager = get_prompt_manager()
    return str(manager.get(key))


def get_diagram_type_prompts(diagram_type: str) -> tuple[str, str]:
    """
    Get both content and diagram prompts for a diagram type.
    
    Args:
        diagram_type: Type of diagram
        
    Returns:
        Tuple of (content_prompt, diagram_prompt)
    """
    manager = get_prompt_manager()
    content = str(manager.get_content_prompt(diagram_type))
    diagram = str(manager.get_diagram_prompt(diagram_type))
    return content, diagram
