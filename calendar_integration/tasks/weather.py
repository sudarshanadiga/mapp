"""
Weather task for daily weather data fetching.

Runs daily to fetch weather forecasts and store them as background events
in the calendar system.
"""

from calendar_integration.services.weather_service import WeatherService

def create_weather_events():
    """Create weather events for the next 14 days."""
    weather_service = WeatherService()
    weather_service.generate_weather_events()

def update_weather_location(location):
    """Update the weather location and regenerate events."""
    weather_service = WeatherService(location)
    weather_service.generate_weather_events() 