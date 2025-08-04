# api/routes.py
"""
API route definitions for PiText CodeGen.
"""

import logging
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from pitext_codegen.api.models import (
    GenRequest,
    CodeGenRequest,
    DeepDiveRequest,
    DiagramResponse,
    CodeResponse,
    DeepDiveResponse,
    HealthResponse,
    FileStub
)
from pitext_codegen.core.config import get_config

logger = logging.getLogger(__name__)
config = get_config()

# Create the main router
router = APIRouter()


# ============================================================================
# 2-Step Workflow Routes
# ============================================================================

@router.post("/generate-diagram", response_model=DiagramResponse)
async def generate_diagram_only(req: GenRequest):
    """STEP 1: Generate only the diagram for user approval."""
    try:
        # Import here to avoid module loading issues
        from pitext_codegen.services.llm.codegen import generate_mermaid_direct
        
        logger.info(f"Generating diagram for prompt: {req.prompt[:50]}...")
        diagram = await generate_mermaid_direct(req.prompt)
        logger.info("Diagram generation completed successfully")
        return DiagramResponse(
            diagram_mermaid=diagram,
            prompt=req.prompt,
            language=req.language
        )
    except Exception as e:
        logger.error(f"Diagram generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-code", response_model=CodeResponse)
async def generate_code_files(req: CodeGenRequest):
    """STEP 2: Generate the actual code files after diagram approval."""
    try:
        # Import here to avoid module loading issues
        from pitext_codegen.services.llm.codegen import generate_single_code_file
        
        logger.info(f"Generating code files for {req.language} project...")
        files = await generate_single_code_file(req.prompt, req.diagram_mermaid, req.language)
        
        deepdive = f"# Implementation Overview\n\nThis code implements: {req.prompt}\n\n## Files Generated\n"
        for filename in files.keys():
            deepdive += f"- **{filename}**: Main implementation file\n"
        
        logger.info(f"Code generation completed with {len(files)} files")
        return CodeResponse(
            files=[FileStub(path=p, content=c) for p, c in files.items()],
            deepdive_md=deepdive
        )
    except Exception as e:
        logger.error(f"Code generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deepdive-node", response_model=DeepDiveResponse)
async def deepdive_node_endpoint(req: DeepDiveRequest):
    """Generate detailed explanation for a specific flowchart node."""
    try:
        # Import here to avoid module loading issues
        from pitext_codegen.services.llm.codegen import deepdive_node
        
        logger.info(f"Generating deepdive for node: {req.node_name} with question: {req.question}")
        explanation = await deepdive_node(
            node_name=req.node_name,
            original_prompt=req.original_prompt,
            flowchart=req.flowchart,
            question=req.question # Pass question to the service layer
        )
        return DeepDiveResponse(explanation=explanation, node_name=req.node_name)
    except Exception as e:
        logger.error(f"Node deepdive failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint."""
    return HealthResponse()

# ============================================================================
# Static File Serving - FIXED
# ============================================================================

def setup_static_routes(app: FastAPI):
    """
    Set up static file serving for the CodeGen frontend.
    
    Args:
        app: FastAPI application instance
    """
    public_dir = config.PUBLIC_DIR
    
    # Mount static assets (CSS, JS, images) under subdirectories
    app.mount(
        f"{config.API_PREFIX}/css",
        StaticFiles(directory=str(public_dir / "css")),
        name="codegen_css"
    )
    
    app.mount(
        f"{config.API_PREFIX}/js",
        StaticFiles(directory=str(public_dir / "js")),
        name="codegen_js"
    )
    
    # Mount other assets if they exist
    assets_dir = public_dir / "assets"
    if assets_dir.exists():
        app.mount(
            f"{config.API_PREFIX}/assets",
            StaticFiles(directory=str(assets_dir)),
            name="codegen_assets"
        )
    
    # Explicit route handlers for the main page
    @app.get(config.API_PREFIX, include_in_schema=False)
    @app.get(f"{config.API_PREFIX}/", include_in_schema=False)
    async def codegen_root():
        """Serve the CodeGen web interface."""
        index_path = public_dir / "index.html"
        if not index_path.exists():
            logger.error(f"index.html not found at {index_path}")
            raise HTTPException(
                status_code=500,
                detail="Application files not found"
            )
        return FileResponse(index_path)
    
    # Serve favicon if it exists
    favicon_path = public_dir / "Strassens_icon.ico"
    if favicon_path.exists():
        @app.get(f"{config.API_PREFIX}/Strassens_icon.ico", include_in_schema=False)
        async def favicon():
            return FileResponse(favicon_path)
    
    # Serve background image if it exists
    #bg_path = public_dir / "PiText_background.png"
    if bg_path.exists():
        @app.get(f"{config.API_PREFIX}/PiText_background.png", include_in_schema=False)
        async def background():
            return FileResponse(bg_path)