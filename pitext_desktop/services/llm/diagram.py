# services/llm/diagram.py
"""
Diagram generation logic using LLM.
Handles diagram type selection, content generation, and diagram creation.
"""

import logging
from typing import Literal

from core.config import get_config
from services.llm.client import get_llm_client
from services.llm.prompts import get_prompt_manager
from services.llm.content import generate_content


logger = logging.getLogger(__name__)

# Type definitions
DiagramType = Literal["flowchart", "radial_mindmap", "sequence_comparison"]


async def select_diagram_type(query: str) -> DiagramType:
    """
    Analyze the query and select the most appropriate diagram type.
    
    Args:
        query: User's query text
        
    Returns:
        Selected diagram type
        
    Raises:
        ValueError: If LLM returns invalid diagram type
    """
    client = get_llm_client()
    config = get_config()
    
    selector_prompt = """You are a diagram-type selector.

As a response to the below query, choose which output representation would be best suited:
- flowchart        : sequential steps, how-to, decision logic
- radial_mindmap   : concept overviews, definitions, characteristics
- sequence_comparison: comparing two or more items, highlighting similarities and unique features

Respond with ONLY one word: "flowchart", "radial_mindmap", or "sequence_comparison"."""
    
    try:
        response = await client.generate_with_system(
            system_prompt=selector_prompt,
            user_prompt=query,
            temperature=0.3,
            max_tokens=config.OPENAI_MAX_TOKENS_SELECTOR
        )
        
        # Validate response
        valid_types = {"flowchart", "radial_mindmap", "sequence_comparison"}
        response_clean = response.strip().lower()
        
        if response_clean not in valid_types:
            logger.warning(f"Invalid diagram type from LLM: {response}")
            # Default to radial_mindmap for general queries
            return "radial_mindmap"
        
        return response_clean  # type: ignore
        
    except Exception as e:
        logger.error(f"Error selecting diagram type: {str(e)}")
        # Default fallback
        return "radial_mindmap"





async def generate_diagram_code(
    content_description: str,
    original_query: str,
    diagram_type: DiagramType
) -> str:
    """
    Generate Mermaid diagram code from content description.
    
    Args:
        content_description: Structured content to visualize
        original_query: Original user query for context
        diagram_type: Type of diagram to generate
        
    Returns:
        Raw Mermaid diagram code
        
    Raises:
        Exception: If diagram generation fails
    """
    client = get_llm_client()
    config = get_config()
    prompt_manager = get_prompt_manager()
    
    # Get appropriate prompt for diagram type
    diagram_prompt = prompt_manager.get_diagram_prompt(diagram_type)
    
    # Build user message based on diagram type
    if diagram_type == "flowchart":
        user_message = (
            f"Create a Mermaid flowchart that answers this query:\n\n"
            f"{original_query}\n\n"
            f"Content details:\n{content_description}"
        )
    elif diagram_type == "sequence_comparison":
        user_message = (
            f"Create a Mermaid sequence diagram for this comparison query:\n\n"
            f"{original_query}\n\n"
            f"Content details:\n{content_description}"
        )
    else:  # radial_mindmap
        user_message = (
            f"Create a radial Mermaid mind-map from this content:\n"
            f"{content_description}"
        )
    
    logger.debug(f"Generating {diagram_type} diagram code")
    
    response = await client.generate_with_system(
        system_prompt=str(diagram_prompt),
        user_prompt=user_message,
        temperature=config.OPENAI_TEMPERATURE,
        max_tokens=config.OPENAI_MAX_TOKENS_DIAGRAM
    )
    
    if not response:
        raise ValueError("Empty diagram response from LLM")
    
    return response


async def generate_deep_dive_response(
    selected_text: str,
    question: str,
    original_query: str = ""
) -> str:
    """
    Generate contextual information about selected diagram content.
    
    Args:
        selected_text: Text selected from the diagram
        question: User's question about the selection
        original_query: Original query that generated the diagram
        
    Returns:
        Detailed explanation or answer
        
    Raises:
        Exception: If generation fails
    """
    client = get_llm_client()
    config = get_config()
    prompt_manager = get_prompt_manager()
    
    # Get deep dive prompt
    deep_dive_prompt = prompt_manager.get("deep_dive")
    
    # Build context-aware user message
    user_message = f'Selected text from diagram: "{selected_text}"\n\n'
    user_message += f'User\'s question: {question}'
    
    if original_query:
        user_message += (
            f"\n\nOriginal query that generated the diagram: {original_query}"
        )
    
    logger.info(f"Generating deep dive response for: {question[:50]}...")
    
    response = await client.generate_with_system(
        system_prompt=str(deep_dive_prompt),
        user_prompt=user_message,
        temperature=config.OPENAI_TEMPERATURE,
        max_tokens=config.OPENAI_MAX_TOKENS_CONTENT
    )
    
    if not response:
        raise ValueError("Empty deep dive response from LLM")
    
    return response


# Convenience function for backward compatibility
async def generate_diagram(query: str) -> str:
    """
    Generate a complete diagram from a query.
    
    This is a convenience function that runs the full generation pipeline.
    
    Args:
        query: User's query text
        
    Returns:
        Raw Mermaid diagram code
    """
    diagram_type = await select_diagram_type(query)
    content = await generate_content(query, diagram_type)
    return await generate_diagram_code(content, query, diagram_type)