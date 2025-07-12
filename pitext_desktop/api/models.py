# api/models.py
"""
Pydantic models for API requests and responses.
Defines the contract between frontend and backend.
"""

from typing import Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, validator


# ============================================================================
# Request Models
# ============================================================================

class DescribeRequest(BaseModel):
    """Request to generate a diagram from a query."""
    query: str = Field(..., min_length=1, max_length=1000)
    
    @validator('query')
    def validate_query(cls, v):
        """Ensure query is not just whitespace."""
        if not v.strip():
            raise ValueError("Query cannot be empty or just whitespace")
        return v.strip()


class DeepDiveRequest(BaseModel):
    """Request for contextual information about selected diagram content."""
    selected_text: str = Field(..., min_length=1, max_length=5000)
    question: str = Field(..., min_length=1, max_length=500)
    original_query: str = Field(default="", max_length=1000)
    
    @validator('selected_text', 'question')
    def validate_not_empty(cls, v):
        """Ensure text fields are not just whitespace."""
        if not v.strip():
            raise ValueError("Field cannot be empty or just whitespace")
        return v.strip()


# ============================================================================
# Response Models
# ============================================================================

class DiagramResponse(BaseModel):
    """Response containing the generated diagram and metadata."""
    success: bool = True
    query: str
    description: str = Field(..., description="Text description of the content")
    # NEW — raw bullet-points / prompt fed into Mermaid
    content: str = Field(..., description="Raw text used to build the diagram")
    diagram_type: Literal["flowchart", "radial_mindmap", "sequence_comparison"]
    diagram: str = Field(..., description="Mermaid diagram code")
    render_type: Literal["html", "image"] = "html"
    rendered_content: Optional[str] = Field(
        None, 
        description="Rendered diagram (HTML or base64 image)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "query": "How do rainbows form?",
                "description": "Rainbow formation process...",
                "diagram_type": "flowchart",
                "diagram": "flowchart TD\n    A[Start] ==> B[End]",
                "render_type": "html",
                "rendered_content": "<div>...</div>"
            }
        }


class DeepDiveResponse(BaseModel):
    """Response containing contextual information about selected content."""
    success: bool = True
    response: str = Field(..., description="Detailed explanation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "response": "The selected concept refers to..."
            }
        }


class ErrorResponse(BaseModel):
    """Standard error response format."""
    success: bool = False
    detail: str = Field(..., description="Error message")
    error_type: Optional[str] = Field(None, description="Error classification")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "detail": "Query is required",
                "error_type": "validation_error"
            }
        }


class HealthResponse(BaseModel):
    """Health check response."""
    message: str = "LLM Diagram Service is running!"
    status: Literal["healthy", "degraded", "unhealthy"] = "healthy"
    version: Optional[str] = Field(None, description="Application version")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "LLM Diagram Service is running!",
                "status": "healthy",
                "version": "1.0.0"
            }
        }


# ============================================================================
# Internal Models (used between services)
# ============================================================================

class DiagramGenerationResult(BaseModel):
    """Internal model for diagram generation results."""
    diagram_type: Literal["flowchart", "radial_mindmap", "sequence_comparison"]
    content_description: str
    mermaid_code: str
    raw_llm_output: Optional[str] = Field(
        None, 
        description="Raw LLM output for debugging"
    )


class RenderResult(BaseModel):
    """Internal model for rendering results."""
    render_type: Literal["html", "image"]
    rendered_content: str


# ============================================================================
# Utility Functions
# ============================================================================

def create_error_response(
    detail: str, 
    error_type: Optional[str] = None
) -> Dict[str, Any]:
    """Create a standardized error response dictionary."""
    return ErrorResponse(
        detail=detail,
        error_type=error_type
    ).dict()


def create_success_response(
    data: BaseModel
) -> Dict[str, Any]:
    """Ensure response includes success=True."""
    response = data.dict()
    response["success"] = True
    return response
