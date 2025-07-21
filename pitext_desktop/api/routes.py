# api/routes.py
"""
API route definitions for PiText Desktop.
Handles all /desktop/* endpoints.
"""

from pathlib import Path
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.models import (
    DescribeRequest,
    DeepDiveRequest,
    DiagramResponse,
    DeepDiveResponse,
    HealthResponse,
    create_error_response,
)
from core.config import get_config
from core.pipeline import process_pipeline
from core.sanitizer import sanitize_mermaid                 # ← NEW
from services.llm.diagram import generate_deep_dive_response

logger = logging.getLogger(__name__)
config = get_config()

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix=config.API_PREFIX)

# ---------------------------------------------------------------------------
# API End‑points
# ---------------------------------------------------------------------------


@router.post("/describe", response_model=DiagramResponse)
async def describe(request: DescribeRequest):
    """Generate a diagram from a text query."""
    try:
        logger.info("Processing describe request: %s...", request.query[:50])

        result = await process_pipeline(request.query)

        # Log the final diagram code being sent to client
        diagram_code = result.get("diagram", "")
        logger.info("📤 Final Mermaid code being sent to client Shri AP for '%s':\n%s", 
                    request.query[:50], diagram_code)

        return DiagramResponse(query=request.query, **result)

    except ValueError as exc:
        logger.error("Validation error: %s", exc)
        raise HTTPException(
            status_code=400,
            detail=create_error_response(str(exc), "validation_error"),
        ) from exc

@router.post("/deep-dive", response_model=DeepDiveResponse)
async def deep_dive(request: DeepDiveRequest):
    """
    Generate an explanatory answer about selected diagram content.
    """
    try:
        logger.info(
            "Deep‑dive request – Text: %s..., Question: %s...",
            request.selected_text[:30],
            request.question[:50],
        )

        response = await generate_deep_dive_response(
            selected_text=request.selected_text,
            question=request.question,
            original_query=request.original_query,
        )

        return DeepDiveResponse(response=response)

    except ValueError as exc:
        logger.error("Validation error: %s", exc)
        raise HTTPException(
            status_code=400,
            detail=create_error_response(str(exc), "validation_error"),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("Unexpected error in deep‑dive: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=create_error_response(
                "An error occurred while generating the response",
                "internal_error",
            ),
        ) from exc


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health‑check end‑point.
    """
    return HealthResponse(status="healthy", version="1.0.0")


# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------


def setup_static_routes(app):
    """
    Register static‑file mounts for the desktop front‑end.
    """
    app.mount(
        f"{config.API_PREFIX}/assets",
        StaticFiles(directory=str(config.PUBLIC_DIR / "assets")),
        name="assets",
    )
    app.mount(
        f"{config.API_PREFIX}/js",
        StaticFiles(directory=str(config.PUBLIC_DIR / "js")),
        name="js",
    )
    app.mount(
        f"{config.API_PREFIX}/css",
        StaticFiles(directory=str(config.PUBLIC_DIR / "css")),
        name="css",
    )

    @app.get(config.API_PREFIX)
    @app.get(f"{config.API_PREFIX}/")
    async def desktop_root():  # noqa: D401, ANN001
        """Serve the main desktop application."""
        index_path = config.PUBLIC_DIR / "index.html"
        if not index_path.exists():
            logger.error("index.html not found at %s", index_path)
            raise HTTPException(
                status_code=500, detail="Application files not found"
            )
        return FileResponse(index_path)

    @app.get(f"{config.API_PREFIX}/{{path:path}}")
    async def catch_all(path: str):  # noqa: D401
        """
        Client‑side routing fall‑back.
        """
        file_path = config.PUBLIC_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        index_path = config.PUBLIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

        raise HTTPException(status_code=404, detail="Not found")
