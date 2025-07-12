# calendar_integration/__init__.py
import os
from flask import Flask
from flask_wtf.csrf import CSRFProtect
import traceback

csrf = CSRFProtect()  # Make CSRFProtect instance importable

def create_app():
    try:
        app = Flask(__name__, 
                    static_folder='static',
                    template_folder='templates')
        
        # Configure secret key for CSRF protection and sessions
        import secrets
        app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', secrets.token_hex(32))
        
        # Enable sessions
        app.config['SESSION_TYPE'] = 'filesystem'
        app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
        
        # Disable CSRF protection globally - we'll implement our own where needed
        app.config['WTF_CSRF_ENABLED'] = False
        
        # Initialize CSRF protection (disabled)
        csrf.init_app(app)

        # Add CORS headers
        @app.after_request
        def after_request(response):
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRFToken')
            response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
            return response

        # Import and register blueprints - moved inside function to avoid circular imports
        try:
            from calendar_integration.api import calendar_api
            app.register_blueprint(calendar_api, url_prefix='')
            print("Calendar API blueprint registered successfully!")
        except Exception as e:
            print(f"Warning: Could not import calendar_api: {e}")
            traceback.print_exc()
            # Create a simple fallback route
            @app.route('/calendar/health')
            def health_fallback_api():
                return {"status": "degraded", "message": "Calendar API not available"}, 200

        return app
    except Exception as e:
        print(f"Error creating calendar app: {e}")
        traceback.print_exc()
        # Return a minimal app that at least responds
        app = Flask(__name__)
        app.config['SECRET_KEY'] = 'fallback-secret-key'
        @app.route('/calendar/health')
        def health_fallback_minimal():
            return {"status": "error", "message": "Calendar service unavailable"}, 500
        return app
# Calendar Integration Module 