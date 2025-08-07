"""Flask routes for the travel planner application.
All routes are grouped under the /travel prefix.
"""
import os
import logging
from flask import Blueprint, render_template, jsonify, request
from flask_wtf.csrf import generate_csrf, CSRFError
from pitext_travel.api.llm import generate_trip_itinerary
from pitext_travel.api.config import get_google_maps_config

# Set up logging
logger = logging.getLogger(__name__)


def create_travel_blueprint(base_dir):
    """Create and configure the travel blueprint.
    
    Args:
        base_dir: Absolute path to the application directory
    
    Returns:
        Configured Flask Blueprint
    """
    travel_bp = Blueprint(
        "travel",
        __name__,
        url_prefix="/travel",
        template_folder=os.path.join(base_dir, 'templates')
    )

    @travel_bp.route("/", strict_slashes=False)
    def index():
        """Landing page for the Travel Planner micro-app."""
        return render_template("map.html")

    @travel_bp.route("/calendar", strict_slashes=False)
    def calendar():
        """Dedicated calendar page for testing FullCalendar integration."""
        return render_template("calendar.html")

    @travel_bp.route("/api/csrf-token", methods=["GET"])
    def get_csrf_token():
        """Get CSRF token for form submissions."""
        return jsonify({"csrf_token": generate_csrf()})

    @travel_bp.route("/api/config", methods=["GET"])
    def get_config():
        """Serve configuration including Google Maps credentials."""
        try:
            config = get_google_maps_config()
            
            # Check for either API key or Client ID setup
            api_key = config["api_key"]
            client_id = config["client_id"]
            
            # Provide debugging info (without exposing full credentials)
            debug_info = {
                "has_api_key": bool(api_key and api_key.strip()),
                "has_client_id": bool(client_id and client_id.strip()),
                "api_key_length": len(api_key) if api_key else 0,
                "client_id_prefix": client_id[:10] + "..." if client_id and len(client_id) > 10 else client_id
            }
            
            logger.info(f"Maps config debug: {debug_info}")
            
            return jsonify({
                "google_maps_api_key": api_key,
                "google_maps_client_id": client_id,
                "auth_type": "client_id" if client_id else "api_key",
                "debug": debug_info
            })
        except Exception as e:
            logger.error(f"Error getting config: {str(e)}")
            return jsonify({"error": "Failed to load configuration"}), 500

    @travel_bp.route("/api/itinerary", methods=["GET", "POST"])
    def get_itinerary():
        """Generate a travel itinerary using the OpenAI API."""
        try:
            # Check if OpenAI API key is configured
            openai_key = os.getenv("OPENAI_API_KEY")
            if not openai_key:
                logger.error("OpenAI API key not configured")
                return jsonify({
                    "error": "OpenAI API key not configured. Please set OPENAI_API_KEY in your environment."
                }), 500
            
            # Parse request data
            if request.method == "POST":
                payload = request.get_json(force=True)
                if not payload:
                    return jsonify({"error": "No data provided"}), 400
                    
                city = payload.get("city", "Paris")
                days = payload.get("days", 3)
                
                # Validate input
                if not city or not isinstance(city, str):
                    return jsonify({"error": "Invalid city name"}), 400
                    
                try:
                    days = int(days)
                    if days < 1 or days > 14:
                        return jsonify({"error": "Days must be between 1 and 14"}), 400
                except (ValueError, TypeError):
                    return jsonify({"error": "Invalid number of days"}), 400
            else:
                city, days = "Paris", 3

            logger.info(f"Generating itinerary for {city}, {days} days")
            
            # Generate itinerary
            itinerary = generate_trip_itinerary(city, days)
            
            # Validate response
            if not itinerary or "days" not in itinerary:
                logger.error(f"Invalid itinerary response: {itinerary}")
                return jsonify({"error": "Failed to generate valid itinerary"}), 500
                
            return jsonify(itinerary)
            
        except CSRFError as e:
            logger.error(f"CSRF error: {str(e)}")
            return jsonify({"error": "CSRF token validation failed"}), 400
        except Exception as e:
            logger.error(f"Error generating itinerary: {str(e)}", exc_info=True)
            error_message = str(e)
            
            # Provide more specific error messages
            if "OPENAI_API_KEY" in error_message:
                return jsonify({
                    "error": "OpenAI API key issue. Please check your configuration."
                }), 500
            elif "quota" in error_message.lower():
                return jsonify({
                    "error": "API quota exceeded. Please try again later."
                }), 429
            else:
                return jsonify({
                    "error": f"Failed to generate itinerary: {error_message}"
                }), 500

    # Error handlers
    @travel_bp.errorhandler(CSRFError)
    def handle_csrf_error(e):
        logger.warning(f"CSRF error: {e}")
        return jsonify({"error": "CSRF token validation failed. Please refresh and try again."}), 400

    @travel_bp.errorhandler(400)
    def handle_bad_request(e):
        return jsonify({"error": "Bad request. Please check your input."}), 400

    @travel_bp.errorhandler(500)
    def handle_server_error(e):
        logger.error(f"Server error: {e}")
        return jsonify({"error": "Internal server error. Please try again later."}), 500

    return travel_bp