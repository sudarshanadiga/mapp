from __future__ import annotations

import logging
from pathlib import Path
import os
import sys

import uvicorn
from fastapi import FastAPI

# Add the project root to the system path to ensure proper module resolution
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from pitext_codegen.api.routes import router as api_router, setup_static_routes
from pitext_codegen.api.middleware import setup_middleware
from pitext_codegen.core.config import get_config

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

config = get_config()

# Update the API_PREFIX to /codegen
config.API_PREFIX = "/codegen"

app = FastAPI(title="PiText CodeGen", version="0.1.0")

# 1. Setup Middleware
setup_middleware(app)

# 2. Include the API routes under the /codegen prefix
app.include_router(api_router, prefix=config.API_PREFIX)

# 3. Setup static routes (this handles serving the UI)
setup_static_routes(app)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)