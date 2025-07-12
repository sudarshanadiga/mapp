"""
ASGI entry-point for the calendar sub-site.

* Wraps a Flask app in WsgiToAsgi so the parent router
  can mount it alongside /desktop and /mobile.
* Starts background scheduler on import.
"""

from __future__ import annotations

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
from asgiref.wsgi import WsgiToAsgi

from calendar_integration.api import calendar_api
from calendar_integration.tasks.scheduler import start_scheduler
from calendar_integration.utils.logger import get_logger

log = get_logger("calendar_integration.main")


def _create_flask() -> Flask:
    import os
    import secrets
    from flask import Flask
    app = Flask("calendar_integration")
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)  # type: ignore[arg-type]

    # Configure secret key for CSRF protection and sessions
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', secrets.token_hex(32))

    # Enable sessions
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours

    # Disable CSRF protection globally - we'll implement our own where needed
    app.config['WTF_CSRF_ENABLED'] = False

    # Add CORS headers
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRFToken')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        
        # Add cache-busting headers for JavaScript files
        if response.mimetype == 'application/javascript':
            response.headers.add('Cache-Control', 'no-cache, no-store, must-revalidate')
            response.headers.add('Pragma', 'no-cache')
            response.headers.add('Expires', '0')
        
        return response

    app.register_blueprint(calendar_api, url_prefix="/calendar")
    return app


# Flask WSGI app
_flask_app = _create_flask()

# Kick off background jobs
start_scheduler()
log.info("Scheduler started")

# Exported ASGI app for router  
asgi_app = WsgiToAsgi(_flask_app)

# For direct execution
if __name__ == "__main__":
    import os
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'True') == 'True'
    
    log.info(f"Starting calendar integration service on {host}:{port}")
    log.info(f"Debug mode: {debug}")
    
    try:
        _flask_app.run(host=host, port=port, debug=debug)
    except KeyboardInterrupt:
        log.info("Shutting down calendar integration service")
    except Exception as e:
        log.error(f"Error starting application: {e}") 