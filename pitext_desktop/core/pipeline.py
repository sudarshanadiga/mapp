# core/pipeline.py
"""
Pipeline orchestration for diagram generation.
Coordinates the flow from query to final diagram.
"""

import logging
from typing import Dict, Any

from core.sanitizer import sanitize_mermaid
from services.llm.diagram import (
    select_diagram_type,
    generate_content,
    generate_diagram_code
)
from services.renderer import render_diagram
from api.models import DiagramGenerationResult, RenderResult


logger = logging.getLogger(__name__)


class DiagramPipeline:
    """Orchestrates the diagram generation pipeline."""
    
    def __init__(self):
        """Initialize the pipeline."""
        self.stages = [
            ("Selecting diagram type", self._select_type),
            ("Generating content", self._generate_content),
            ("Creating diagram", self._create_diagram),
            ("Sanitizing output", self._sanitize_diagram),
            ("Rendering diagram", self._render_diagram)
        ]
    
    async def process(self, query: str) -> Dict[str, Any]:
        """
        Process a query through the complete pipeline.
        
        Args:
            query: User's query text
            
        Returns:
            Dict containing all pipeline results
            
        Raises:
            Exception: If any pipeline stage fails
        """
        logger.info(f"Starting pipeline for query: {query[:50]}...")
        
        # Initialize pipeline context
        context = {
            "query": query,
            "diagram_type": None,
            "content_description": None,
            "raw_diagram": None,
            "sanitized_diagram": None,
            "render_result": None
        }
        
        # Execute pipeline stages
        for stage_name, stage_func in self.stages:
            logger.info(f"Stage: {stage_name}")
            try:
                await stage_func(context)
            except Exception as e:
                logger.error(f"Pipeline failed at stage '{stage_name}': {str(e)}")
                raise
        
        # Build final result
        return self._build_result(context)
    
    async def _select_type(self, context: Dict[str, Any]) -> None:
        """Stage 1: Select the appropriate diagram type."""
        context["diagram_type"] = await select_diagram_type(context["query"])
        logger.info(f"Selected diagram type: {context['diagram_type']}")
    
    async def _generate_content(self, context: Dict[str, Any]) -> None:
        """Stage 2: Generate content description."""
        context["content_description"] = await generate_content(
            query=context["query"],
            diagram_type=context["diagram_type"]
        )
        logger.debug("🟡 RAW Mermaid code ↓\n%s", context["raw_diagram"])
    
    async def _create_diagram(self, context: Dict[str, Any]) -> None:
        """Stage 3: Generate Mermaid diagram code."""
        context["raw_diagram"] = await generate_diagram_code(
            content_description=context["content_description"],
            original_query=context["query"],
            diagram_type=context["diagram_type"]
        )
        
        # Log raw Mermaid code at INFO level so it shows in render logs
        logger.info("🟡 RAW Mermaid code for query '%s':\n%s", 
                    context["query"][:50], context["raw_diagram"])

    async def _sanitize_diagram(self, context: Dict[str, Any]) -> None:
        """Stage 4: Sanitize the Mermaid code."""
        context["sanitized_diagram"] = sanitize_mermaid(context["raw_diagram"])
        
        # Log sanitized Mermaid code at INFO level
        logger.info("🟢 SANITIZED Mermaid code for query '%s':\n%s", 
                    context["query"][:50], context["sanitized_diagram"])
        
        # Log if changes were made during sanitization
        if context["raw_diagram"] != context["sanitized_diagram"]:
            logger.info("⚠️ Diagram was modified during sanitization for query '%s'", 
                        context["query"][:50])
            
    async def _render_diagram(self, context: Dict[str, Any]) -> None:
        """Stage 5: Render the diagram (HTML or image)."""
        context["render_result"] = await render_diagram(
            context["sanitized_diagram"]
        )
        logger.info(f"Rendered as: {context['render_result'].render_type}")
    
    def _build_result(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Build the final result dictionary."""
        render_result = context["render_result"]
        
        return {
            "description": context["content_description"],
            "content":      context["content_description"], 
            "diagram_type": context["diagram_type"],
            "diagram": context["sanitized_diagram"],
            "render_type": render_result.render_type,
            "rendered_content": render_result.rendered_content
        }


# Create a singleton pipeline instance
_pipeline = DiagramPipeline()


async def process_pipeline(query: str) -> Dict[str, Any]:
    """
    Process a query through the diagram generation pipeline.
    
    This is the main entry point for diagram generation.
    
    Args:
        query: User's query text
        
    Returns:
        Dict containing:
        - description: Text description of the content
        - diagram_type: Selected diagram type
        - diagram: Sanitized Mermaid code
        - render_type: "html" or "image"
        - rendered_content: Rendered output
        
    Raises:
        ValueError: If query is invalid
        Exception: If pipeline processing fails
    """
    if not query or not query.strip():
        raise ValueError("Query cannot be empty")
    
    return await _pipeline.process(query.strip())
