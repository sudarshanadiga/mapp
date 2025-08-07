"""LLM integration for travel planning."""
import os
import json
import logging
from typing import Dict, List, Any
import openai
from openai import OpenAI

logger = logging.getLogger(__name__)


def generate_trip_itinerary(city: str, days: int) -> Dict[str, Any]:
    """
    Generate a trip itinerary using OpenAI API.
    
    Args:
        city: Destination city
        days: Number of days for the trip
        
    Returns:
        Dict containing itinerary with days array
        
    Raises:
        ValueError: If inputs are invalid
        Exception: If API call fails
    """
    # Validate inputs
    if not city or not isinstance(city, str):
        raise ValueError("City must be a non-empty string")
    
    if not isinstance(days, int) or days < 1 or days > 14:
        raise ValueError("Days must be an integer between 1 and 14")
    
    # Get API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OpenAI API key not found in environment")
        raise ValueError("OpenAI API key not configured")
    
    try:
        # Initialize OpenAI client
        client = OpenAI(api_key=api_key)
        
        # Create the prompt
        prompt = f"""Generate a {days}-day travel itinerary for {city}.
        
        For each day, provide 3-5 stops with specific locations.
        
        Return the response as a JSON object with this exact structure:
        {{
            "city": "{city}",
            "days": [
                {{
                    "label": "Day 1",
                    "stops": [
                        {{
                            "name": "Location Name",
                            "lat": latitude_number,
                            "lng": longitude_number,
                            "placeType": "attraction/restaurant/museum/etc"
                        }}
                    ]
                }}
            ]
        }}
        
        Important:
        - Include real, accurate latitude and longitude coordinates
        - Each day should have 3-5 stops
        - Mix different types of places (attractions, restaurants, etc.)
        - Ensure coordinates are accurate for the actual locations
        """
        
        logger.info(f"Calling OpenAI API for {city}, {days} days")
        
        # Make API call
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a travel planning assistant. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        # Extract response
        content = response.choices[0].message.content
        logger.debug(f"Raw API response: {content[:200]}...")
        
        # Parse JSON response
        try:
            # Clean up the response if needed
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            itinerary = json.loads(content)
            
            # Validate the response structure
            if "days" not in itinerary:
                raise ValueError("Response missing 'days' field")
            
            if not isinstance(itinerary["days"], list):
                raise ValueError("'days' field must be an array")
            
            if len(itinerary["days"]) == 0:
                raise ValueError("No days in itinerary")
            
            # Ensure city is included
            itinerary["city"] = city
            
            # Validate each day
            for i, day in enumerate(itinerary["days"]):
                if "label" not in day:
                    day["label"] = f"Day {i + 1}"
                
                if "stops" not in day or not isinstance(day["stops"], list):
                    raise ValueError(f"Day {i + 1} missing valid stops array")
                
                # Validate each stop
                for j, stop in enumerate(day["stops"]):
                    if "name" not in stop:
                        raise ValueError(f"Stop {j + 1} on day {i + 1} missing name")
                    
                    # Ensure coordinates are numbers
                    try:
                        if "lat" in stop:
                            stop["lat"] = float(stop["lat"])
                        if "lng" in stop:
                            stop["lng"] = float(stop["lng"])
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid coordinates for {stop.get('name', 'unknown stop')}")
                        # Remove invalid coordinates
                        stop.pop("lat", None)
                        stop.pop("lng", None)
            
            logger.info(f"Successfully generated itinerary with {len(itinerary['days'])} days")
            return itinerary
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Response content: {content}")
            raise ValueError("Invalid JSON response from API")
            
    except openai.AuthenticationError:
        logger.error("OpenAI API authentication failed")
        raise ValueError("Invalid OpenAI API key")
    except openai.RateLimitError:
        logger.error("OpenAI API rate limit exceeded")
        raise ValueError("API rate limit exceeded. Please try again later.")
    except openai.APIError as e:
        logger.error(f"OpenAI API error: {e}")
        raise ValueError(f"API error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error generating itinerary: {e}", exc_info=True)
        raise


# For backward compatibility or testing
def get_sample_itinerary(city: str = "Paris", days: int = 3) -> Dict[str, Any]:
    """Get a sample itinerary for testing when API is not available."""
    sample = {
        "city": city,
        "days": []
    }
    
    # Sample data for Paris
    sample_stops = [
        [
            {"name": "Eiffel Tower", "lat": 48.8584, "lng": 2.2945, "placeType": "attraction"},
            {"name": "Louvre Museum", "lat": 48.8606, "lng": 2.3376, "placeType": "museum"},
            {"name": "Notre-Dame Cathedral", "lat": 48.8530, "lng": 2.3499, "placeType": "attraction"},
            {"name": "Champs-Élysées", "lat": 48.8698, "lng": 2.3078, "placeType": "attraction"}
        ],
        [
            {"name": "Sacré-Cœur", "lat": 48.8867, "lng": 2.3431, "placeType": "attraction"},
            {"name": "Montmartre", "lat": 48.8847, "lng": 2.3406, "placeType": "neighborhood"},
            {"name": "Arc de Triomphe", "lat": 48.8738, "lng": 2.2950, "placeType": "attraction"},
            {"name": "Latin Quarter", "lat": 48.8508, "lng": 2.3429, "placeType": "neighborhood"}
        ],
        [
            {"name": "Versailles Palace", "lat": 48.8049, "lng": 2.1204, "placeType": "attraction"},
            {"name": "Musée d'Orsay", "lat": 48.8600, "lng": 2.3266, "placeType": "museum"},
            {"name": "Luxembourg Gardens", "lat": 48.8462, "lng": 2.3372, "placeType": "park"},
            {"name": "Panthéon", "lat": 48.8462, "lng": 2.3465, "placeType": "attraction"}
        ]
    ]
    
    for i in range(min(days, 3)):
        sample["days"].append({
            "label": f"Day {i + 1}",
            "stops": sample_stops[i] if i < len(sample_stops) else sample_stops[0]
        })
    
    return sample