"""Entry point for the pitext_travel micro-service.
Minimal setup that delegates route registration to routes module.
"""
import os
import secrets
from flask import Flask
from pitext_travel.routes.travel import create_travel_blueprint
from pitext_travel.api.chat import bp_chat
from flask_socketio import SocketIO
from pitext_travel.routes.websocket import TravelVoiceNS
from asgiref.wsgi import WsgiToAsgi
from flask_wtf.csrf import CSRFProtect

# Get the absolute path to the directory where this file is located
base_dir = os.path.abspath(os.path.dirname(__file__))

# Create the main Flask app
app = Flask(
    __name__,
    static_url_path="/travel/static",
    static_folder=os.path.join(base_dir, 'static')
)

# Generate secret key dynamically
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_NAME'] = 'pitext_travel_session'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Register blueprints
app.register_blueprint(create_travel_blueprint(base_dir))
app.register_blueprint(bp_chat)

# Create SocketIO wrapper with async_mode='threading'
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins="*")

# Register your namespace
socketio.on_namespace(TravelVoiceNS('/travel/voice'))

# Create a custom ASGI app that handles both Flask and SocketIO
class TravelASGIApp:
    def __init__(self, flask_app, socketio_app):
        self.flask_app = WsgiToAsgi(flask_app)
        self.socketio_app = socketio_app
    
    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        
        # Route SocketIO requests to the SocketIO app
        if path.startswith("/socket.io"):
            # For SocketIO, we need to handle it differently
            # Since SocketIO with threading mode doesn't have asgi_app,
            # we'll route these to the Flask app which has SocketIO integrated
            await self.flask_app(scope, receive, send)
            return
        
        # Route all other requests to the Flask app
        await self.flask_app(scope, receive, send)

# Export the custom ASGI app
asgi_app = TravelASGIApp(app, socketio)

# Optional: local dev runner
if __name__ == "__main__":
    socketio.run(app, port=int(os.getenv("PORT", 3000)), debug=True)