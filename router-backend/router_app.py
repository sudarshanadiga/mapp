import sys
import importlib.util
from pathlib import Path
import logging

from fastapi.responses import RedirectResponse, Response, FileResponse
from starlette.types import ASGIApp, Receive, Scope, Send
from fastapi import FastAPI
from starlette.middleware.wsgi import WSGIMiddleware
from starlette.responses import JSONResponse

BASE_DIR = Path(__file__).parent.parent

# Add this list of known colliding module prefixes
COLLIDING_MODULE_PREFIXES = ['core', 'api']

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helper: dynamically load a FastAPI/Flask app from a folder
# ---------------------------------------------------------------------------
def load_app_module(app_path: Path, module_name: str, asgi_name="asgi_app") -> ASGIApp:
    """
    Dynamically load a FastAPI or Flask app as ASGI.
    Prefers `asgi_app` if present, else falls back to `app`.
    """
    print(f"Loading module from: {app_path}")
    main_file = app_path / "main.py"
    if not main_file.exists():
        raise FileNotFoundError(f"main.py not found in {app_path}")

    # Clear colliding modules from the system cache before importing the new app.
    # This forces a fresh load of modules like 'core.config' and 'api.routes' for each app.
    for module_to_remove in list(sys.modules.keys()):
        if any(module_to_remove.startswith(prefix) for prefix in COLLIDING_MODULE_PREFIXES):
            del sys.modules[module_to_remove]

    spec = importlib.util.spec_from_file_location(module_name, main_file)
    if not spec or not spec.loader:
        raise ImportError(f"Could not load module spec for {main_file}")

    module = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(app_path))
    spec.loader.exec_module(module)
    sys.path.remove(str(app_path))

    app = getattr(module, asgi_name, getattr(module, "app", None))
    if app is None:
        raise ImportError(f"Could not find ASGI app in {main_file}")

    return app

# Load existing applications
desktop_app = load_app_module(BASE_DIR / "pitext_desktop", "desktop_main")

try:
    mobile_app = load_app_module(BASE_DIR / "pitext-mobile", "mobile_main")
except Exception as mobile_error:
    mobile_app = FastAPI()

    def create_mobile_error_handler(error):
        async def mobile_error_handler(path: str):
            return {"error": f"Mobile app failed to load: {str(error)}", "path": path}
        return mobile_error_handler

    mobile_app.get("/{path:path}")(create_mobile_error_handler(mobile_error))

codegen_app = load_app_module(BASE_DIR / "pitext_codegen", "codegen_main")

# Set up sys.path for absolute imports
base_path = BASE_DIR.resolve()
if str(base_path) not in sys.path:
    sys.path.insert(0, str(base_path))

app = FastAPI(title="PiText Router")

# ---------------------------------------------------------------------------
# Helper: determine mobile by User-Agent header
# ---------------------------------------------------------------------------
def is_mobile(scope: Scope) -> bool:
    headers = dict(scope.get("headers") or [])
    ua_bytes = headers.get(b"user-agent", b"").lower()
    return any(x in ua_bytes for x in [b"android", b"mobi", b"iphone"])

# ---------------------------------------------------------------------------
# Main ASGI router - Clean routing logic only
# ---------------------------------------------------------------------------
class RouterApp:
    def __init__(self, desktop: ASGIApp, mobile: ASGIApp, codegen: ASGIApp):
        self.desktop = desktop
        self.mobile = mobile
        self.codegen = codegen

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.desktop(scope, receive, send)
            return

        path = scope.get("path", "")

        # Handle favicon requests
        if path == "/favicon.ico":
            favicon_path = BASE_DIR / "pitext_desktop" / "public" / "assets" / "Strassens_icon.ico"
            if favicon_path.exists():
                response = FileResponse(favicon_path)
                await response(scope, receive, send)
                return
            else:
                # Return 404 if favicon not found
                response = Response(
                    content='{"detail":"Favicon not found"}',
                    media_type="application/json",
                    status_code=404,
                )
                await response(scope, receive, send)
                return


        if path.startswith("/codegen"):
            await self.codegen(scope, receive, send)
            return

        if path == "/":
            target_path = "/mobile/" if is_mobile(scope) else "/desktop/"
            response = RedirectResponse(url=target_path)
            await response(scope, receive, send)
            return

        if path.startswith("/desktop"):
            await self.desktop(scope, receive, send)
            return

        if path.startswith("/mobile"):
            await self.mobile(scope, receive, send)
            return

        response = Response(
            content='{"detail":"Not Found"}',
            media_type="application/json",
            status_code=404,
        )
        await response(scope, receive, send)

# Instantiate the ASGI app that Render will pick up
app = RouterApp(desktop_app, mobile_app, codegen_app)
