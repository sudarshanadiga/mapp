# api/llm.py
"""OpenAI API integration for generating travel itineraries."""
import json
import re
import logging
from openai import OpenAI
from pitext_travel.api.config import get_openai_api_key
from pitext_travel.api.geocoding import enhance_with_geocoding, get_estimated_coordinates

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_client() -> OpenAI:
    """Return an OpenAI client initialized from the OPENAI_API_KEY env var."""
    api_key = get_openai_api_key()
    return OpenAI(api_key=api_key, timeout=30.0)

def generate_trip_itinerary(city, days=3):
    """
    Generate a multi-day itinerary using OpenAI + Google Geocoding for accurate coordinates.
    """
    logger.info(f"Starting enhanced itinerary generation for {city}, {days} days")
    
    try:
        client = get_client()
        
        # Enhanced prompt for better place names
        system_prompt = (
            "You are a knowledgeable travel expert. Generate a detailed day-by-day itinerary "
            "with specific, well-known attractions and landmarks. "
            "For each stop, provide the exact name as it would appear on Google Maps. "
            "Focus on must-see attractions, museums, landmarks, and popular areas. "
            "Keep each day to 3-4 stops maximum for a comfortable pace. "
            "Return ONLY a JSON object with this exact structure: "
            '{"days":[{"label":"Day 1","color":"#ff6b6b","stops":[{"name":"Exact Place Name"}]}]}'
        )
        
        user_prompt = (
            f"Create a {days}-day itinerary for {city}. Include specific landmark names, "
            f"famous attractions, and notable areas. Make sure place names are accurate "
            f"and would be recognized by Google Maps."
        )

        logger.info("Making OpenAI API call for itinerary...")
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent place names
            max_tokens=1500,
            timeout=25
        )
        
        text = response.choices[0].message.content.strip()
        logger.info(f"Received OpenAI response length: {len(text)} characters")
        
        # Log the full response for debugging
        if len(text) < 1000:
            logger.info(f"Full OpenAI response: {text}")
        else:
            logger.info(f"OpenAI response (first 500 chars): {text[:500]}...")
            logger.info(f"OpenAI response (last 500 chars): ...{text[-500:]}")
        
        # Clean and parse JSON
        text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'```\s*$', '', text, flags=re.MULTILINE)
        text = text.strip()
        
        try:
            itinerary = json.loads(text)
            logger.info("Successfully parsed JSON response")
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            logger.error(f"Failed to parse text: {text}")
            
            # Try regex extraction as fallback
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                try:
                    itinerary = json.loads(json_match.group(0))
                    logger.info("Successfully parsed JSON using regex extraction")
                except json.JSONDecodeError:
                    logger.error("Regex extraction also failed")
                    raise ValueError("No valid JSON found in response")
            else:
                raise ValueError("No JSON structure found in response")
        
        # Validate the structure
        if not isinstance(itinerary, dict) or 'days' not in itinerary:
            logger.error(f"Invalid itinerary structure: {itinerary}")
            raise ValueError("Invalid itinerary structure - missing 'days' key")
        
        # Enhance with Google geocoding
        logger.info("Enhancing itinerary with geocoding...")
        enhanced_itinerary = enhance_with_geocoding(itinerary, city)
        
        logger.info("Successfully generated enhanced itinerary")
        return enhanced_itinerary
        
    except Exception as e:
        logger.error(f"Error generating itinerary: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        return get_fallback_itinerary(city, days)
def get_fallback_itinerary(city, days):
    """Generate a basic fallback itinerary"""
    colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff"]
    
    fallback = {"days": []}
    
    for i in range(days):
        lat, lng = get_estimated_coordinates(city)
        
        # Create slight variations for different stops
        stops = []
        for j in range(3):
            offset_lat = lat + (j * 0.01) - 0.01
            offset_lng = lng + (j * 0.01) - 0.01
            
            stops.append({
                "name": f"{city} Attraction {j+1}",
                "lat": offset_lat,
                "lng": offset_lng
            })
        
        fallback["days"].append({
            "label": f"Day {i+1}",
            "color": colors[i % len(colors)],
            "stops": stops
        })
    
    return fallback


# Testing
if __name__ == "__main__":
    result = generate_trip_itinerary("Prague", 3)
    print(json.dumps(result, indent=2))