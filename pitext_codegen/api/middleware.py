# api/middleware.py
"""
Middleware configuration for PiText CodeGen.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

def setup_middleware(app: FastAPI) -> None:
    """
    Configure all middleware for the application.
    
    Args:
        app: FastAPI application instance
    """
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.info("CORS middleware configured to allow all origins.")