# api/models.py
"""
Pydantic models for the CodeGen API.
Defines the contract between the frontend and backend.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# ============================================================================
# Request Models
# ============================================================================

class GenRequest(BaseModel):
    """Request to generate a diagram."""
    prompt: str = Field(..., description="Natural-language description of what to build")
    language: str = Field("python", examples=["python", "typescript"])

class CodeGenRequest(BaseModel):
    """Request to generate code files after diagram approval."""
    prompt: str
    language: str
    diagram_mermaid: str
    diagram_type: str

class DeepDiveRequest(BaseModel):
    """Request for a detailed explanation of a flowchart node."""
    node_name: str = Field(..., description="The text content of the selected node")
    question: str = Field(..., description="The user's question about the node")
    original_prompt: str = Field(..., description="The initial requirement prompt")
    flowchart: str = Field(..., description="The complete Mermaid flowchart for context")

# ============================================================================
# Response Models
# ============================================================================

class FileStub(BaseModel):
    """Represents a single generated code file."""
    path: str
    content: str

class DiagramResponse(BaseModel):
    """Response for the diagram generation step."""
    diagram_mermaid: str
    diagram_type: str = "flowchart"
    prompt: str
    language: str

class CodeResponse(BaseModel):
    """Response for the code generation step."""
    files: List[FileStub]
    deepdive_md: str

class DeepDiveResponse(BaseModel):
    """Response for a deep-dive explanation."""
    success: bool = True
    explanation: str
    node_name: str

class ErrorResponse(BaseModel):
    """Standard error response format."""
    success: bool = False
    detail: str = Field(..., description="Error message")
    error_type: Optional[str] = Field(None, description="Error classification")

class HealthResponse(BaseModel):
    """Health check response."""
    message: str = "CodeGen Service is running!"
    workflow: str = "2-step"

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