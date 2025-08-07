"""
Weather API endpoints for calendar integration.

Public routes
-------------
GET    /calendar/weather
POST   /calendar/weather/location
POST   /calendar/weather/refresh
"""

from flask import Blueprint, request, make_response
from calendar_integration.services.weather_service import WeatherService
from calendar_integration.tasks.weather import update_weather_location, create_weather_events
from calendar_integration.api._helpers import ok, err, parse_json

weather_bp = Blueprint("weather", __name__)

# ---------------------------------------------------------------------
# Get current weather data
# ---------------------------------------------------------------------
@weather_bp.get("/weather")
def get_weather_data():
    """Get current weather data and forecast."""
    try:
        # Get location from query params or use default
        location = request.args.get('location', 'New York')
        
        weather_service = WeatherService(location)
        forecast_data = weather_service.fetch_weather()
        
        if not forecast_data:
            return err("Failed to fetch weather data", 500)
        
        # Generate weather events for display
        weather_events = weather_service.generate_weather_events()
        
        # Ensure events have the updated color scheme
        if weather_events:
            for event in weather_events:
                if event.get('type') == 'weather-warning':
                    event['backgroundColor'] = '#ffb3b3'  # Light red/pink
                    event['borderColor'] = '#ff8080'
                    event['textColor'] = '#d00000'
        
        return ok({
            "location": location,
            "forecast": forecast_data,
            "weather_events": weather_events or [],  # Add the weather events to response
            "message": "Weather events generated successfully"
        })
        
    except Exception as e:
        return err("Failed to fetch weather data", 500)

# ---------------------------------------------------------------------
# Update weather location
# ---------------------------------------------------------------------
@weather_bp.post("/weather/location")
def update_location():
    """Update the weather location and regenerate events."""
    try:
        data = parse_json(request)
        location = data.get('location')
        
        if not location:
            return err("Location is required", 400)
        
        # Update the weather location
        update_weather_location(location)
        
        return ok({
            "message": f"Weather location updated to {location}",
            "location": location
        })
            
    except Exception as e:  # Changed from 'catch' to 'except'
        return err("Failed to update weather location", 500)

# ---------------------------------------------------------------------
# Refresh weather data
# ---------------------------------------------------------------------
@weather_bp.post("/weather/refresh")
def refresh_weather():
    """Manually refresh weather data."""
    try:
        # Create new weather events
        create_weather_events()
        
        return ok({
            "message": "Weather data refreshed successfully"
        })
        
    except Exception as e:
        return err("Failed to refresh weather data", 500) 