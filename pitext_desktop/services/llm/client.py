# services/llm/client.py
"""
OpenAI client management and LLM interaction utilities.
Provides a singleton client and common LLM operations.
"""

from typing import Optional, List, Dict, Any
from functools import lru_cache
import logging

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from core.config import get_config


logger = logging.getLogger(__name__)


class LLMClient:
    """Manages OpenAI client instance and provides LLM operations."""
    
    def __init__(self):
        """Initialize the OpenAI client with configuration."""
        config = get_config()
        self.api_key = config.OPENAI_API_KEY
        self.model = config.OPENAI_MODEL
        self.default_temperature = config.OPENAI_TEMPERATURE
        
        if not self.api_key:
            raise ValueError("OpenAI API key not configured")
        
        self._client = AsyncOpenAI(api_key=self.api_key)
    
    async def generate(
        self,
        messages: List[ChatCompletionMessageParam],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Generate a completion using the OpenAI API.
        
        Args:
            messages: List of chat messages
            temperature: Override default temperature
            max_tokens: Maximum tokens in response
            model: Override default model
            **kwargs: Additional OpenAI API parameters
            
        Returns:
            Generated text response
            
        Raises:
            Exception: If API call fails
        """
        try:
            response = await self._client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                temperature=temperature or self.default_temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response from OpenAI")
                
            return content.strip()
            
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise
    
    async def generate_with_system(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs
    ) -> str:
        """
        Convenience method for simple system/user message generation.
        
        Args:
            system_prompt: System message content
            user_prompt: User message content
            **kwargs: Additional parameters for generate()
            
        Returns:
            Generated text response
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        return await self.generate(messages, **kwargs)
    
    async def test_connection(self) -> bool:
        """
        Test the OpenAI API connection.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            response = await self.generate_with_system(
                system_prompt="You are a helpful assistant.",
                user_prompt="Say 'OK' if you can hear me.",
                max_tokens=5,
                temperature=0
            )
            return "OK" in response
        except Exception as e:
            logger.error(f"Connection test failed: {str(e)}")
            return False


@lru_cache()
def get_llm_client() -> LLMClient:
    """
    Get singleton LLM client instance.
    
    Returns:
        Configured LLMClient instance
    """
    return LLMClient()


async def quick_generate(
    prompt: str,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None
) -> str:
    """
    Quick generation helper for simple prompts.
    
    Args:
        prompt: User prompt
        max_tokens: Maximum response tokens
        temperature: Generation temperature
        
    Returns:
        Generated response
    """
    client = get_llm_client()
    return await client.generate_with_system(
        system_prompt="You are a helpful assistant.",
        user_prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature
    )
