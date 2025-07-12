# services/llm/content.py
"""
Content generation logic using LLM.
Handles generating structured content descriptions from user queries.
"""

import logging
import re
from typing import Dict, List, Optional

from core.config import get_config
from services.llm.client import get_llm_client
from services.llm.prompts import get_prompt_manager

logger = logging.getLogger(__name__)


class ContentGenerator:
    """Generates structured content descriptions for diagrams."""
    
    def __init__(self):
        self.client = get_llm_client()
        self.prompt_manager = get_prompt_manager()
        self.config = get_config()
    
    async def generate(
        self,
        query: str,
        diagram_type: str,
        max_items: Optional[int] = None
    ) -> str:
        """
        Generate structured content description based on query and diagram type.
        
        Args:
            query: User's query text
            diagram_type: Type of diagram (affects content structure)
            max_items: Maximum number of items to generate
            
        Returns:
            Structured content description
        
        Raises:
            ValueError: If content generation fails or validation fails
        """
        # Get appropriate prompt
        prompt = self.prompt_manager.get_content_prompt(diagram_type)
        
        # Add max items constraint if specified
        if max_items:
            user_message = f"{query}\n\nPlease limit to {max_items} main points."
        else:
            user_message = query
        
        logger.debug(f"Generating {diagram_type} content for: {query[:50]}...")
        
        try:
            response = await self.client.generate_with_system(
                system_prompt=str(prompt),
                user_prompt=user_message,
                temperature=self.config.OPENAI_TEMPERATURE,
                max_tokens=self.config.OPENAI_MAX_TOKENS_CONTENT
            )
            
            if not response:
                raise ValueError("Empty content response from LLM")
            
            # Validate content structure
            if not self._validate_content(response, diagram_type):
                raise ValueError("Invalid content structure")
            
            return response
        
        except Exception as e:
            logger.error(f"Content generation failed: {str(e)}")
            raise
    
    
    def _validate_standard_content(self, content: str) -> bool:
        """
        Validate "standard" content:
         - Must include a "Main topic:" or "Topic:" line
         - Must have at least one fact, which can be:
           * A bullet ("- ..")
           * A numbered item ("1. ..")
           * A line containing the word "fact"
        """
        lines = [l.strip() for l in content.splitlines() if l.strip()]

        # 1) Topic line
        has_topic = any(
            re.match(r'^(main topic|topic)\s*[:\-]', line, re.IGNORECASE)
            for line in lines
        )
        if not has_topic:
            return False

        # 2) Fact count
        fact_count = 0
        for line in lines:
            if line.startswith('- '):
                fact_count += 1
            elif re.match(r'^\d+\.\s+', line):
                fact_count += 1
            elif 'fact' in line.lower():
                fact_count += 1

        return fact_count >= 1
    
    
    def _validate_comparison_content(self, content: str) -> bool:
        """Validate comparison content format."""
        content_lower = content.lower()
        if 'items:' not in content_lower:
            return False
        if 'similarity' not in content_lower:
            return False
        if 'unique' not in content_lower:
            return False
        return True


    def _validate_content(self, content: str, diagram_type: str) -> bool:
        """
        Dispatch to the appropriate validator based on diagram_type.
        """
        if diagram_type == "sequence_comparison":
            return self._validate_comparison_content(content)
        else:
            return self._validate_standard_content(content)
    

    def parse_content(self, content: str, diagram_type: str) -> Dict:
        """
        Parse structured content into a dictionary.
        
        Args:
            content: Structured content string
            diagram_type: Type of content
        
        Returns:
            Parsed content dictionary
        """
        if diagram_type == "sequence_comparison":
            return self._parse_comparison_content(content)
        else:
            return self._parse_standard_content(content)
    
    
    def _parse_standard_content(self, content: str) -> Dict:
        """Parse standard content format into {'topic': str, 'facts': List[str]}."""
        lines = content.strip().split('\n')
        result = {'topic': '', 'facts': []}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            low = line.lower()
            if low.startswith('main topic:') or low.startswith('topic:'):
                result['topic'] = line.split(':', 1)[1].strip()
            elif any(low.startswith(f'fact {i}:') for i in range(1, 10)):
                fact_text = line.split(':', 1)[1].strip()
                result['facts'].append(fact_text)
            elif line.startswith('- '):
                result['facts'].append(line[2:].strip())
            elif re.match(r'^\d+\.\s+', line):
                result['facts'].append(re.sub(r'^\d+\.\s+', '', line).strip())
        
        return result
    
    
    def _parse_comparison_content(self, content: str) -> Dict:
        """Parse comparison content format into items, similarities, and unique_features."""
        lines = content.strip().split('\n')
        result = {'items': [], 'similarities': [], 'unique_features': {}}
        current_item = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            low = line.lower()
            if low.startswith('items:'):
                items = line.split(':', 1)[1].split(',')
                result['items'] = [item.strip() for item in items]
                for item in result['items']:
                    result['unique_features'][item] = []
            
            elif 'similarity' in low and ':' in line:
                sim = line.split(':', 1)[1].strip()
                result['similarities'].append(sim)
            
            elif 'unique' in low and ':' in line:
                parts = line.split(' unique ')
                if parts:
                    current_item = parts[0].strip()
                    feat = line.split(':', 1)[1].strip()
                    if current_item in result['unique_features']:
                        result['unique_features'][current_item].append(feat)
        
        return result


class ContentEnricher:
    """Enriches content with additional context and details."""
    
    def __init__(self):
        self.client = get_llm_client()
        self.config = get_config()
    
    async def enrich(
        self,
        content: str,
        query: str,
        enrichment_type: str = "examples"
    ) -> str:
        """
        Enrich content with additional information.
        
        Args:
            content: Base content to enrich
            query: Original user query
            enrichment_type: Type of enrichment ('examples', 'details', 'context')
        
        Returns:
            Enriched content
        """
        enrichment_prompts = {
            "examples": "Add 1-2 concrete examples to each point:",
            "details" : "Add more specific details to each point:",
            "context" : "Add relevant context and background to each point:"
        }
        prompt = enrichment_prompts.get(enrichment_type, enrichment_prompts["examples"])
        
        system_message = (
            f"You are enriching content for better understanding.\n"
            f"{prompt}\n"
            "Keep additions concise (10-15 words per addition).\n"
            "Maintain the original structure."
        )
        user_message = f"Original query: {query}\n\nContent to enrich:\n{content}"
        
        try:
            response = await self.client.generate_with_system(
                system_prompt=system_message,
                user_prompt=user_message,
                temperature=0.7,
                max_tokens=self.config.OPENAI_MAX_TOKENS_CONTENT
            )
            return response.strip()
        except Exception as e:
            logger.warning(f"Content enrichment failed: {str(e)}")
            return content


# Convenience functions

async def generate_content(
    query: str,
    diagram_type: str,
    enrich: bool = False
) -> str:
    """
    Generate content description for a query.
    """
    generator = ContentGenerator()
    content = await generator.generate(query, diagram_type)
    if enrich:
        enricher = ContentEnricher()
        content = await enricher.enrich(content, query)
    return content


async def parse_and_validate_content(
    content: str,
    diagram_type: str
) -> Dict:
    """
    Parse and validate content structure.
    """
    generator = ContentGenerator()
    if not generator._validate_content(content, diagram_type):
        raise ValueError("Content did not pass validation")
    return generator.parse_content(content, diagram_type)
