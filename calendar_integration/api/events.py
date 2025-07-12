"""
Calendar event CRUD endpoints.

Public routes
-------------
GET    /calendar/events
POST   /calendar/events
PUT    /calendar/events/<event_id>
DELETE /calendar/events/<event_id>
POST   /calendar/generate-events
"""

from __future__ import annotations

from typing import Any

from flask import Blueprint, request, render_template, send_from_directory, make_response
import os
from datetime import datetime

from calendar_integration.services.calendar_client import CalendarClient
from calendar_integration.services.event_generator import EventGenerator
from calendar_integration.utils.logger import get_logger
from calendar_integration.api._helpers import csrf_protect, ok, err, parse_json, require_args

events_bp = Blueprint("events", __name__)
logger = get_logger(__name__)

client = CalendarClient()  # imported once, thread-safe
event_generator = EventGenerator()

# ---------------------------------------------------------------------
# Main calendar page
# ---------------------------------------------------------------------
@events_bp.get("/")
def index():
    """Main calendar page."""
    logger.info("Calendar index page requested")
    return render_template('calendar.html')

# ---------------------------------------------------------------------
# Favicon
# ---------------------------------------------------------------------
@events_bp.get("/favicon.ico")
def favicon():
    """Serve favicon."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    static_folder = os.path.join(os.path.dirname(current_dir), 'static')
    return send_from_directory(static_folder, 'favicon.ico')

# ---------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------
@events_bp.get("/health")
def health_check():
    """Health check endpoint."""
    logger.info("Health check requested")
    return ok({
        "calendar_client_initialized": True,  # Always initialized with new storage
        "event_generator_initialized": event_generator.initialized,
        "timestamp": datetime.utcnow().isoformat()
    })

# ---------------------------------------------------------------------
# CSRF token
# ---------------------------------------------------------------------
@events_bp.get("/csrf-token")
def get_csrf_token():
    """Get CSRF token for calendar operations."""
    try:
        # Generate a simple token without Flask-WTF if it fails
        import secrets
        csrf_token = secrets.token_urlsafe(32)
        logger.info("Generated simple CSRF token")
        return ok({"csrf_token": csrf_token})
    except Exception as e:
        logger.error(f"Failed to generate CSRF token: {str(e)}")
        return err("Failed to generate CSRF token", 500)

# ---------------------------------------------------------------------
# Set session user
# ---------------------------------------------------------------------
@events_bp.post("/set-session-user")
def set_session_user():
    """Set user_id in session for OAuth flow."""
    from flask import session
    data = parse_json(request)
    user_id = data.get('user_id')
    if user_id:
        session['user_id'] = user_id
        session.modified = True
        logger.info(f"Set session user_id: {user_id}")
        return ok({"status": "success"})
    return err("No user_id provided", 400)

# ---------------------------------------------------------------------
# List events
# ---------------------------------------------------------------------
@events_bp.get("/events")
@require_args("user_id")
def list_events():
    """Get all events for a user."""
    user_id = request.args.get("user_id")
    logger.info(f"Fetching events for user: {user_id}")
    
    # Check for Google token
    token_path = os.path.join(os.path.dirname(__file__), '..', 'google_tokens.json')
    token_data = {}
    actual_token_user = None
    
    try:
        with open(token_path, 'r') as f:
            import json
            token_data = json.load(f)
            logger.info(f"Available tokens for users: {list(token_data.keys())}")
            logger.info(f"Requested user_id: '{user_id}'")
            
            # Determine which user's token to use
            if user_id in token_data:
                actual_token_user = user_id
            elif 'demo_user' in token_data:
                actual_token_user = 'demo_user'
            elif token_data:
                actual_token_user = list(token_data.keys())[0]
                
            logger.info(f"Will use token for user: {actual_token_user}")
    except Exception as e:
        logger.warning(f"Could not read token file: {e}")
    
    # Only try Google Calendar if we have a valid token user
    if actual_token_user and token_data.get(actual_token_user):
        logger.info(f"Found Google token, using GoogleCalendarClient with token from user: {actual_token_user}")
        try:
            from calendar_integration.services.google_calendar_client import GoogleCalendarClient
            
            google_client = GoogleCalendarClient()
            
            # Use the actual token user for fetching
            events = google_client.fetch_events(actual_token_user)
            logger.info(f"Fetched {len(events)} events from Google Calendar")
            
            # Format Google events to match your schema
            formatted_events = []
            for event in events:
                formatted_event = {
                    'event_id': event.get('id'),
                    'title': event.get('summary', 'Untitled'),
                    'description': event.get('description', ''),
                    'location': event.get('location', ''),
                    'start_time': event.get('start', {}).get('dateTime', event.get('start', {}).get('date')),
                    'end_time': event.get('end', {}).get('dateTime', event.get('end', {}).get('date')),
                    'all_day': 'date' in event.get('start', {}),
                    'source': 'google',
                    'user_id': user_id  # Keep the original user_id
                }
                formatted_events.append(formatted_event)
            
            # Also include local events
            local_events = client.fetch_events(user_id or "default_user")
            if isinstance(local_events, list):
                for event in local_events:
                    event['source'] = 'local'
                formatted_events.extend(local_events)
            
            logger.info(f"Successfully fetched {len(formatted_events)} total events (Google + local) for user: {user_id}")
            resp, status = ok(formatted_events)
            return make_response(resp, status)
        except Exception as e:
            logger.error(f"Error fetching Google Calendar events: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            logger.info("Falling back to local calendar only")
    else:
        logger.info(f"No Google token available, using local calendar only")
    
    # Use local CalendarClient
    if not isinstance(user_id, str) or not user_id:
        resp, status = err("user_id is required and must be a non-empty string", 400)
        return make_response(resp, status)
        
    events = client.fetch_events(user_id)
    if isinstance(events, dict) and "error" in events:
        logger.error(f"Error fetching events: {events.get('error')}")
        resp, status = err(events.get("error", "Unknown error"), 500)
        return make_response(resp, status)
    if not isinstance(events, list):
        logger.error("Invalid events data format")
        resp, status = err("Invalid events data format", 500)
        return make_response(resp, status)
        
    # Mark all events as local
    for event in events:
        event['source'] = 'local'
        
    logger.info(f"Successfully fetched {len(events)} local events for user: {user_id}")
    resp, status = ok(events)
    return make_response(resp, status)

# ---------------------------------------------------------------------
# Get specific event
# ---------------------------------------------------------------------
@events_bp.get("/events/<string:event_id>")
@require_args("user_id")
def get_event(event_id: str):
    """Get a specific event by ID."""
    user_id = request.args.get("user_id")
    logger.info(f"Fetching event {event_id} for user: {user_id}")
    if not isinstance(user_id, str) or not user_id:
        logger.error("user_id is required and must be a non-empty string")
        resp, status = err("user_id is required and must be a non-empty string", 400)
        return make_response(resp, status)
    try:
        events = client.fetch_events(user_id)
        
        if isinstance(events, dict) and "error" in events:
            logger.error(f"Error fetching events: {events.get('error')}")
            resp, status = err(events.get("error", "Unknown error"), 500)
            return make_response(resp, status)
        
        if not isinstance(events, list):
            logger.error("Invalid events data format")
            resp, status = err("Invalid events data format", 500)
            return make_response(resp, status)
        
        # Find the specific event
        for event in events:
            if isinstance(event, dict):
                event_id_from_data = event.get('id') or event.get('event_id')
                if str(event_id_from_data) == str(event_id):
                    logger.info(f"Successfully found event {event_id}")
                    resp, status = ok(event)
                    return make_response(resp, status)
        
        logger.warning(f"Event {event_id} not found for user: {user_id}")
        resp, status = err("Event not found", 404)
        return make_response(resp, status)
        
    except Exception as e:
        logger.error(f"Unexpected error in get_event: {str(e)}")
        resp, status = err("Internal server error", 500)
        return make_response(resp, status)

# ---------------------------------------------------------------------
# Create an event
# ---------------------------------------------------------------------
@events_bp.post("/events")
def create_event():
    """Create a new event."""
    logger.info("=== CREATE EVENT REQUEST START ===")
    
    # Validate CSRF token for POST requests (make it optional for now)
    try:
        from flask_wtf.csrf import validate_csrf
        csrf_token = request.headers.get('X-CSRFToken')
        if csrf_token:
            validate_csrf(csrf_token)
            logger.info("CSRF token validation passed")
        else:
            logger.warning("No CSRF token provided in request")
    except Exception as e:
        logger.warning(f"CSRF token validation failed: {e}")
        # Don't return error, just log the warning
    
    payload = parse_json(request)
    logger.info(f"Request body: {payload}")
    
    # Validate user_id in request body
    user_id = payload.get('user_id')
    logger.info(f"User ID from request: {user_id}")
    
    if not user_id or not user_id.strip():
        logger.warning("Invalid or missing user_id in create_event request body")
        return err("user_id is required in request body and must not be empty", 400)
    
    logger.info(f"Creating new event: {payload.get('title', 'Untitled')} for user: {user_id}")
    
    # Normalise & validate eventType
    ev_type = payload.get("eventType", "other").strip().lower()
    if ev_type not in {"work", "fun", "other"}:
        ev_type = "other"
    payload["eventType"] = ev_type
    logger.info(f"Normalized eventType to: {ev_type}")
    
    try:
        # Validate event data
        logger.info("Validating event data...")
        from calendar_integration.utils.validators import validate_event_data
        validate_event_data(payload, is_creation=True)
        logger.info("Event data validation passed")
        
        # Parse datetime strings if needed
        from calendar_integration.utils.datetime import parse_datetime
        if isinstance(payload.get('start_time'), str):
            payload['start_time'] = parse_datetime(payload['start_time'])
            logger.info(f"Parsed start_time: {payload['start_time']}")
        if isinstance(payload.get('end_time'), str):
            payload['end_time'] = parse_datetime(payload['end_time'])
            logger.info(f"Parsed end_time: {payload['end_time']}")
        
        logger.info("Calling calendar_client.create_event...")
        event = client.create_event(payload)
        logger.info(f"Calendar client response: {event}")
        
        if isinstance(event, dict) and "error" in event:
            logger.error(f"Error creating event: {event['error']}")
            return err(event["error"], 400)
        
        # Ensure the response has all needed fields
        if isinstance(event, dict):
            if 'id' not in event and 'event_id' in event:
                event['id'] = event['event_id']
            elif 'event_id' not in event and 'id' in event:
                event['event_id'] = event['id']
        
        logger.info(f"Successfully created event: {event.get('event_id')}")
        logger.info("=== CREATE EVENT REQUEST END ===")
        resp, status = ok(event, 201)
        return make_response(resp, status)
        
    except ValueError as e:
        logger.error(f"Validation error creating event: {str(e)}")
        return err(f"Validation error: {str(e)}", 400)
    except Exception as e:
        logger.error(f"Unexpected error in create_event: {str(e)}")
        logger.error(f"Exception type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return err("Internal server error", 500)

# ---------------------------------------------------------------------
# Update event
# ---------------------------------------------------------------------
@events_bp.put("/events/<string:event_id>")
def update_event(event_id: str):
    """Update an existing event."""
    # Validate CSRF token for PUT requests (make it optional for now)
    try:
        from flask_wtf.csrf import validate_csrf
        csrf_token = request.headers.get('X-CSRFToken')
        if csrf_token:
            validate_csrf(csrf_token)
        else:
            logger.warning("No CSRF token provided in request")
    except Exception as e:
        logger.warning(f"CSRF token validation failed: {e}")
        # Don't return error, just log the warning
    
    payload = parse_json(request)
    user_id = request.args.get('user_id')
    
    if not user_id or not user_id.strip():
        logger.warning("Invalid or missing user_id in update_event request")
        return err("user_id is required and must not be empty", 400)
    
    if not event_id:
        logger.warning("Missing event_id in update_event request")
        return err("event_id is required", 400)
    
    logger.info(f"Updating event {event_id} for user: {user_id}")
    
    try:
        # Validate event data
        from calendar_integration.utils.validators import validate_event_data
        validate_event_data(payload)
        
        # Parse datetime strings if needed
        from calendar_integration.utils.datetime import parse_datetime
        if isinstance(payload.get('start_time'), str):
            payload['start_time'] = parse_datetime(payload['start_time'])
        if isinstance(payload.get('end_time'), str):
            payload['end_time'] = parse_datetime(payload['end_time'])
        
        updated_event = client.update_event(event_id, payload)
        
        if isinstance(updated_event, dict) and "error" in updated_event:
            logger.error(f"Error updating event: {updated_event['error']}")
            return err(updated_event["error"], 404)
        
        logger.info(f"Successfully updated event: {event_id}")
        resp, status = ok(updated_event)
        return make_response(resp, status)
        
    except ValueError as e:
        logger.error(f"Validation error updating event: {str(e)}")
        return err(f"Validation error: {str(e)}", 400)
    except Exception as e:
        logger.error(f"Unexpected error in update_event: {str(e)}")
        return err("Internal server error", 500)

# ---------------------------------------------------------------------
# Delete event
# ---------------------------------------------------------------------
@events_bp.delete("/events/<string:event_id>")
def delete_event(event_id: str):
    """Delete an event."""
    # Validate CSRF token for DELETE requests (make it optional for now)
    try:
        from flask_wtf.csrf import validate_csrf
        csrf_token = request.headers.get('X-CSRFToken')
        if csrf_token:
            validate_csrf(csrf_token)
        else:
            logger.warning("No CSRF token provided in request")
    except Exception as e:
        logger.warning(f"CSRF token validation failed: {e}")
        # Don't return error, just log the warning
    
    user_id = request.args.get('user_id')
    
    if not user_id or not user_id.strip():
        logger.warning("Invalid or missing user_id in delete_event request")
        return err("user_id is required and must not be empty", 400)
    
    if not event_id:
        logger.warning("Missing event_id in delete_event request")
        return err("event_id is required", 400)
    
    logger.info(f"Deleting event {event_id} for user: {user_id}")
    
    try:
        result = client.delete_event(event_id)
        
        if isinstance(result, dict) and "error" in result:
            logger.error(f"Error deleting event: {result['error']}")
            return err(result["error"], 404)
        
        logger.info(f"Successfully deleted event: {event_id}")
        resp, status = ok(result)
        return make_response(resp, status)
        
    except Exception as e:
        logger.error(f"Unexpected error in delete_event: {str(e)}")
        return err("Internal server error", 500)

# ---------------------------------------------------------------------
# Generate events using AI
# ---------------------------------------------------------------------
@events_bp.post("/generate-events")
def generate_events():
    """Generate events using AI."""
    # Validate CSRF token for POST requests (make it optional for now)
    try:
        from flask_wtf.csrf import validate_csrf
        csrf_token = request.headers.get('X-CSRFToken')
        if csrf_token:
            validate_csrf(csrf_token)
        else:
            logger.warning("No CSRF token provided in request")
    except Exception as e:
        logger.warning(f"CSRF token validation failed: {e}")
        # Don't return error, just log the warning
    
    user_data = parse_json(request)
    
    if not user_data:
        logger.warning("Missing request body in generate_events")
        return err("Request body is required", 400)
    
    logger.info("Generating events using AI")
    
    try:
        generated_events = event_generator.generate(user_data)
        
        # Check if generated_events is an error response
        if isinstance(generated_events, dict) and "error" in generated_events:
            logger.error(f"Error generating events: {generated_events['error']}")
            return err(generated_events["error"], 400)
        
        # Ensure generated_events is a list
        if not isinstance(generated_events, list):
            logger.error("Invalid response from event generator")
            return err("Invalid response from event generator", 500)
        
        if not generated_events:
            logger.warning("No events were generated")
            return err("No events were generated", 400)
        
        created_events = client.batch_create_events(generated_events)
        
        logger.info(f"Successfully generated and created events")
        resp, status = ok(created_events, 201)
        return make_response(resp, status)
        
    except Exception as e:
        logger.error(f"Unexpected error in generate_events: {str(e)}")
        return err("Internal server error", 500)

# ---------------------------------------------------------------------
# Test endpoints
# ---------------------------------------------------------------------
@events_bp.get("/test-static")
def test_static():
    """Test static file serving."""
    logger.info("Testing static file serving")
    return ok({
        "message": "Static file test endpoint",
        "static_url": "/static/css/calendar.css",
        "favicon_url": "/favicon.ico"
    })

@events_bp.get("/test")
def test_endpoint():
    """Simple test endpoint to verify calendar service is working."""
    logger.info("Test endpoint requested")
    return ok({
        "message": "Calendar service is working",
        "timestamp": datetime.utcnow().isoformat(),
        "calendar_client_initialized": True,  # Always initialized with new storage
        "event_generator_initialized": event_generator.initialized
    })

@events_bp.get("/debug-storage")
def debug_storage():
    """Debug endpoint to check storage status."""
    import os
    from calendar_integration.api.config import Config
    file_path = Config.CALENDAR_EVENTS_FILE
    exists = os.path.exists(file_path)
    size = os.path.getsize(file_path) if exists else 0
    # Try to read the file
    content = "N/A"
    if exists:
        try:
            with open(file_path, 'r') as f:
                content = f.read()[:500]  # First 500 chars
        except Exception as e:
            content = f"Error reading: {e}"
    return ok({
        "file_path": file_path,
        "exists": exists,
        "size": size,
        "content_preview": content,
        "working_directory": os.getcwd()
    }) 