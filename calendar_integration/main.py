"""
ASGI entry‑point for the **Calendar Integration** micro‑service.

This version mirrors the pattern used in **pitext_travel/main.py** to
avoid the *CurrentThreadExecutor already quit or is broken* error seen
under heavy static‑file traffic when using ``WsgiToAsgi`` directly.

Key changes
===========
1. Create a long‑lived :class:`CalendarASGIApp` wrapper that delegates
   every incoming scope to a **single** ``WsgiToAsgi`` instance.  This
   keeps the executor alive for the whole process lifetime, preventing
   the intermittent shutdown bug.
2. Keep all Flask functionality unchanged – background scheduler,
   blueprints, CSRF, etc. – so the rest of the codebase stays intact.
3. Make the static folder explicit via ``static_url_path="/calendar/static"``
   so assets continue to resolve exactly as before.

If you later add WebSocket namespaces (e.g. Socket.IO) you can branch in
``__call__`` exactly like *TravelASGIApp* does in **pitext_travel**.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
from asgiref.wsgi import WsgiToAsgi

from calendar_integration.api import calendar_api
from calendar_integration.tasks.scheduler import start_scheduler
from calendar_integration.utils.logger import get_logger

log = get_logger("calendar_integration.main")
BASE_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------------------
# Flask factory – unchanged except for explicit static/template paths
# ---------------------------------------------------------------------------

def _create_flask() -> Flask:
    app = Flask(
        "calendar_integration",
        template_folder=str(BASE_DIR / "templates"),       # Jinja2
    )

    # Reverse‑proxy fix (Render ↔️ uvicorn ↔️ Flask)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)  # type: ignore[arg-type]

    # Core config
    app.config.update(
        SECRET_KEY=os.getenv("FLASK_SECRET_KEY", secrets.token_hex(32)),
        SESSION_COOKIE_NAME="pitext_calendar_session",
        PERMANENT_SESSION_LIFETIME=86400,  # 24 h
        WTF_CSRF_ENABLED=False,            # handled manually where needed
    )

    # CORS / cache headers
    @app.after_request
    def _after(resp):
        resp.headers.add("Access-Control-Allow-Origin", "*")
        resp.headers.add(
            "Access-Control-Allow-Headers",
            "Content-Type,Authorization,X-CSRFToken",
        )
        resp.headers.add(
            "Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS"
        )
        return resp

    # Blueprints
    app.register_blueprint(calendar_api, url_prefix="")
    return app


# ---------------------------------------------------------------------------
# Initialise Flask + scheduler
# ---------------------------------------------------------------------------

_flask_app = _create_flask()
start_scheduler()
log.info("Scheduler started")


# ---------------------------------------------------------------------------
# Custom ASGI wrapper (mirrors pitext_travel pattern)
# ---------------------------------------------------------------------------

class CalendarASGIApp:
    """Route every ASGI scope to a single WSGI‑to‑ASGI adapter.

    Having one long‑lived ``WsgiToAsgi`` instance prevents the background
    thread‑executor from being torn down between requests, which was the
    root cause of the *CurrentThreadExecutor* runtime error.
    """

    def __init__(self, flask_app: Flask):
        self._wsgi = WsgiToAsgi(flask_app)

    async def __call__(self, scope, receive, send):
        # In the future, branch here for WebSocket paths (e.g. "/socket.io").
        await self._wsgi(scope, receive, send)


# Export for uvicorn / Render
asgi_app = CalendarASGIApp(_flask_app)


# ---------------------------------------------------------------------------
# Local development runner (optional)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    log.info(f"Starting calendar service on {host}:{port} (debug={debug})")
    _flask_app.run(host=host, port=port, debug=debug) 