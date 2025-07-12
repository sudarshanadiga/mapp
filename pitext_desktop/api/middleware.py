# api/middleware.py
"""
Middleware configuration for PiText Desktop.
Handles CORS, logging, error handling, and request/response processing.
"""

import time
import logging
from typing import Callable
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import get_config
from api.models import create_error_response


logger = logging.getLogger(__name__)


def setup_cors(app: FastAPI) -> None:
    """
    Configure CORS middleware for the application.
    
    Args:
        app: FastAPI application instance
    """
    config = get_config()
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_credentials=config.CORS_ALLOW_CREDENTIALS,
        allow_methods=config.CORS_ALLOW_METHODS,
        allow_headers=config.CORS_ALLOW_HEADERS,
    )
    
    logger.info(f"CORS configured with origins: {config.CORS_ORIGINS}")


async def log_requests(request: Request, call_next: Callable) -> Response:
    """
    Middleware to log all incoming requests and their processing time.
    
    Args:
        request: Incoming request
        call_next: Next middleware/handler in chain
        
    Returns:
        Response from the handler
    """
    # Generate request ID for tracking
    request_id = str(uuid4())[:8]
    
    # Log request start
    start_time = time.time()
    logger.info(
        f"[{request_id}] {request.method} {request.url.path} "
        f"from {request.client.host if request.client else 'unknown'}"
    )
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    
    # Log request completion
    logger.info(
        f"[{request_id}] Completed in {process_time:.3f}s "
        f"with status {response.status_code}"
    )
    
    # Add custom headers
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{process_time:.3f}"
    
    return response


async def handle_errors(request: Request, call_next: Callable) -> Response:
    """
    Global error handling middleware.
    
    Catches unhandled exceptions and returns consistent error responses.
    
    Args:
        request: Incoming request
        call_next: Next middleware/handler in chain
        
    Returns:
        Response from the handler or error response
    """
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(
            f"Unhandled exception for {request.method} {request.url.path}: {str(e)}",
            exc_info=True
        )
        
        # Don't expose internal errors in production
        config = get_config()
        if config.is_production():
            error_detail = "An internal error occurred"
        else:
            error_detail = str(e)
        
        return JSONResponse(
            status_code=500,
            content=create_error_response(
                detail=error_detail,
                error_type="internal_error"
            )
        )


async def add_security_headers(request: Request, call_next: Callable) -> Response:
    """
    Add security headers to all responses.
    
    Args:
        request: Incoming request
        call_next: Next middleware/handler in chain
        
    Returns:
        Response with security headers
    """
    response = await call_next(request)
    
    # Add security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Add cache headers for static assets
    if request.url.path.startswith(f"{get_config().API_PREFIX}/assets"):
        response.headers["Cache-Control"] = "public, max-age=31536000"  # 1 year
    elif request.url.path.endswith((".js", ".css")):
        response.headers["Cache-Control"] = "public, max-age=86400"  # 1 day
    
    return response


def setup_middleware(app: FastAPI) -> None:
    """
    Configure all middleware for the application.
    
    Order matters! Middleware is executed in reverse order for responses.
    
    Args:
        app: FastAPI application instance
    """
    # CORS should be first
    setup_cors(app)
    
    # Add custom middleware (order matters for response processing)
    app.middleware("http")(add_security_headers)
    app.middleware("http")(handle_errors)
    app.middleware("http")(log_requests)
    
    logger.info("All middleware configured")


def setup_exception_handlers(app: FastAPI) -> None:
    """
    Configure custom exception handlers.
    
    Args:
        app: FastAPI application instance
    """
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        """Handle ValueError exceptions."""
        return JSONResponse(
            status_code=400,
            content=create_error_response(
                detail=str(exc),
                error_type="validation_error"
            )
        )
    
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        """Handle 404 errors."""
        return JSONResponse(
            status_code=404,
            content=create_error_response(
                detail=f"Path {request.url.path} not found",
                error_type="not_found"
            )
        )
    
    logger.info("Exception handlers configured")
