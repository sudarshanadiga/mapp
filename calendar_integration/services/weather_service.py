import requests
import json
from datetime import datetime

OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast"
GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search"
DEFAULT_LOCATION = "New York"
CALENDAR_EVENTS_FILE = "calendar_events.json"

# Weather code descriptions
WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
}

class WeatherService:
    def __init__(self, location=DEFAULT_LOCATION):
        self.location = location
        self.latitude = None
        self.longitude = None
        self._geocode_location()

    def _geocode_location(self):
        """Convert location name to coordinates."""
        try:
            # Use Open-Meteo's geocoding API
            response = requests.get(GEOCODING_API, params={
                "name": self.location,
                "count": 1,
                "language": "en",
                "format": "json"
            })

            if response.status_code == 200:
                data = response.json()
                if data.get("results") and len(data["results"]) > 0:
                    result = data["results"][0]
                    self.latitude = result["latitude"]
                    self.longitude = result["longitude"]
                    print(f"Geocoded {self.location} to {self.latitude}, {self.longitude}")
                else:
                    # Fallback to New York if location not found
                    print(f"Location {self.location} not found, using New York coordinates")
                    self.latitude = 40.7128
                    self.longitude = -74.0060
            else:
                # Fallback to New York if geocoding fails
                print(f"Geocoding failed for {self.location}, using New York coordinates")
                self.latitude = 40.7128
                self.longitude = -74.0060

        except Exception as e:
            print(f"Error geocoding location: {e}")
            # Fallback to New York
            self.latitude = 40.7128
            self.longitude = -74.0060

    def fetch_weather(self):
        if not self.latitude or not self.longitude:
            self._geocode_location()

        params = {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode",
            "timezone": "auto",
            "forecast_days": 14,
            "temperature_unit": "fahrenheit"
        }

        try:
            response = requests.get(OPEN_METEO_API, params=params)
            return response.json()
        except Exception as e:
            print(f"Error fetching weather: {e}")
            return None

    def classify_weather(self, day_forecast):
        temp_max = day_forecast['temperature_2m_max']
        temp_min = day_forecast['temperature_2m_min']
        precip_prob = day_forecast['precipitation_probability_max']
        wind_speed = day_forecast['windspeed_10m_max']
        weather_code = day_forecast['weathercode']

        # Adjust thresholds for different climates
        # Kuwait City has much higher temperatures
        if "kuwait" in self.location.lower():
            bad_conditions = (
                temp_min < 32 or temp_max > 115 or  # Adjusted for Kuwait's climate
                precip_prob > 40 or
                wind_speed > 35 or  # Dust storms
                weather_code in [95, 96, 99, 77, 85, 86]
            )
        else:
            bad_conditions = (
                temp_min < 32 or temp_max > 95 or
                precip_prob > 40 or
                wind_speed > 25 or
                weather_code in [95, 96, 99, 77, 85, 86]
            )
        return "bad" if bad_conditions else "good"

    def get_weather_reason(self, day_forecast):
        """Get a short reason for why the weather is bad."""
        reasons = []

        temp_max = day_forecast['temperature_2m_max']
        temp_min = day_forecast['temperature_2m_min']
        precip_prob = day_forecast['precipitation_probability_max']
        wind_speed = day_forecast['windspeed_10m_max']
        weather_code = day_forecast['weathercode']

        # Check for specific weather conditions first
        if weather_code in WEATHER_CODES:
            weather_desc = WEATHER_CODES[weather_code]
            if weather_code in [95, 96, 99]:
                reasons.append("Thunderstorm")
            elif weather_code in [77, 85, 86]:
                reasons.append("Snow")
            elif weather_code in [65, 67, 82]:
                reasons.append("Heavy Rain")
            elif weather_code in [61, 63, 80, 81]:
                if precip_prob > 40:
                    reasons.append(f"Rain {int(precip_prob)}%")

        # Check temperature extremes
        if temp_max > 95:
            reasons.append(f"Hot {int(temp_max)}°F")
        elif temp_min < 32:
            reasons.append(f"Freezing {int(temp_min)}°F")

        # Check precipitation if not already added
        if not any("Rain" in r or "Snow" in r or "Thunderstorm" in r for r in reasons):
            if precip_prob > 70:
                reasons.append(f"Heavy Rain {int(precip_prob)}%")
            elif precip_prob > 40:
                reasons.append(f"Rain {int(precip_prob)}%")

        # Check wind
        if wind_speed > 35:
            reasons.append(f"Strong Wind {int(wind_speed)}mph")
        elif wind_speed > 25:
            reasons.append(f"Windy {int(wind_speed)}mph")

        # Return the most important reason or combine top 2
        if len(reasons) >= 2:
            return f"{reasons[0]}, {reasons[1]}"
        elif reasons:
            return reasons[0]
        else:
            return "Poor Conditions"

    def generate_weather_events(self):
        forecast_data = self.fetch_weather()
        if not forecast_data:
            print("No forecast data available")
            return

        weather_events = []
        dates = forecast_data['daily']['time']

        for i, date_str in enumerate(dates):
            day_forecast = {
                'temperature_2m_max': forecast_data['daily']['temperature_2m_max'][i],
                'temperature_2m_min': forecast_data['daily']['temperature_2m_min'][i],
                'precipitation_probability_max': forecast_data['daily']['precipitation_probability_max'][i],
                'windspeed_10m_max': forecast_data['daily']['windspeed_10m_max'][i],
                'weathercode': forecast_data['daily']['weathercode'][i]
            }

            classification = self.classify_weather(day_forecast)

            if classification == "bad":
                # Determine the reason for bad weather
                reason = self.get_weather_reason(day_forecast)

                event = {
                    'event_id': f'weather-{date_str}',
                    'title': f'⛈️ Bad Weather ({reason})',
                    'start_time': date_str,
                    'end_time': date_str,
                    'all_day': True,
                    # Remove 'display': 'background' completely
                    'backgroundColor': '#ffb3b3',
                    'type': 'weather-warning',
                    'details': day_forecast,
                    'editable': False  # Make non-editable
                }
                weather_events.append(event)

        self.save_weather_events(weather_events)
        return weather_events

    def save_weather_events(self, events):
        try:
            with open(CALENDAR_EVENTS_FILE, 'r') as file:
                calendar_events = json.load(file)
        except FileNotFoundError:
            calendar_events = []

        # Remove old weather events
        calendar_events = [e for e in calendar_events if e.get('type') != 'weather-warning']

        # Add new weather events
        calendar_events.extend(events)

        with open(CALENDAR_EVENTS_FILE, 'w') as file:
            json.dump(calendar_events, file, indent=4) 