# main.py
"""
PiText desktop- Main application entry point.
"""

import logging
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from asgiref.wsgi import WsgiToAsgi

# Import travel app
sys.path.append(str(Path(__file__).parent.parent))
from pitext_travel.main import app as travel_flask_app
from outscraper.routes import router as outscraper_router


# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from api.routes import router, setup_static_routes
from api.middleware import setup_middleware
from core.config import get_config


def setup_logging():
    """Configure application logging."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )
    
    # Set specific loggers to INFO level
    logging.getLogger("core.pipeline").setLevel(logging.INFO)
    logging.getLogger("core.sanitizer").setLevel(logging.INFO)
    logging.getLogger("api.routes").setLevel(logging.INFO)

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    config = get_config()

    app = FastAPI(
        title="PiText",
        description="Visual code generation, Mermaid diagram creator, travel planner, and business review finder",
        version="0.1.0",
    )

    # Middleware (CORS, Logging, Security, etc.)
    setup_middleware(app)

    # Mount static files for outscraper
    outscraper_path = Path(__file__).parent.parent / "outscraper"
    if outscraper_path.exists():
        app.mount(
            "/desktop/outscraper",
            StaticFiles(directory=str(outscraper_path)),
            name="outscraper_static"
        )
    else:
        logging.warning(f"Outscraper directory not found at {outscraper_path}")

    # Mount static files
    setup_static_routes(app)

    # API routes for desktop
    app.include_router(router)
    
    # Include Outscraper routes
    app.include_router(outscraper_router)

    # Mount the travel Flask app as a sub-application
    travel_asgi_app = WsgiToAsgi(travel_flask_app)
    app.mount("/travel", travel_asgi_app, name="travel")

    # Root redirect
    @app.get("/", include_in_schema=False)
    async def root_redirect():
        return RedirectResponse(url=config.API_PREFIX or "/codegen")

    return app


def main():
    setup_logging()
    config = get_config()

    app = create_app()

    logging.info(f"PiText running at http://{config.HOST}:{config.PORT}")

    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )


app = create_app()

if __name__ == "__main__":
    main()