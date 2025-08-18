"""
Outscraper service integration for business and review data
"""
import os
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from outscraper/.env if it exists
outscraper_env_path = Path(__file__).parent / '.env'
if outscraper_env_path.exists():
    load_dotenv(outscraper_env_path)
else:
    # Fall back to root .env
    load_dotenv()

try:
    from outscraper import ApiClient
    OUTSCRAPER_AVAILABLE = True
except ImportError:
    ApiClient = None
    OUTSCRAPER_AVAILABLE = False
    logging.warning("Outscraper package not installed. Install with: pip install outscraper")

logger = logging.getLogger(__name__)


class OutscraperService:
    """Service for interacting with Outscraper API"""
    
    def __init__(self):
        self.api_key = os.getenv('OUTSCRAPER_API_KEY')
        self.is_configured = bool(self.api_key and OUTSCRAPER_AVAILABLE)
        
        if self.is_configured:
            try:
                self.client = ApiClient(api_key=self.api_key)
                logger.info("Outscraper service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Outscraper client: {str(e)}")
                self.is_configured = False
                self.client = None
        else:
            if not self.api_key:
                logger.warning("OUTSCRAPER_API_KEY not found in environment variables")
            if not OUTSCRAPER_AVAILABLE:
                logger.warning("Outscraper package not installed")
            self.client = None
    
    def check_availability(self) -> Dict[str, Any]:
        """Check if the service is available and configured"""
        return {
            "available": self.is_configured,
            "has_api_key": bool(self.api_key),
            "client_initialized": self.client is not None,
            "package_installed": OUTSCRAPER_AVAILABLE
        }
    
    async def search_businesses(
        self, 
        query: str, 
        location: str = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search for businesses using Google Maps
        
        Args:
            query: Search query (e.g., "restaurants", "coffee shops")
            location: Location to search in (e.g., "New York, NY")
            limit: Maximum number of results
            
        Returns:
            List of business data
        """
        if not self.is_configured:
            logger.error("Outscraper service not configured")
            return self._get_mock_businesses(query, location, limit)
        
        try:
            search_query = f"{query}, {location}" if location else query
            logger.info(f"Searching for businesses: {search_query}")
            
            results = self.client.google_maps_search(
                query=search_query,
                limit=limit,
                language='en',
                region='US'
            )
            
            # Flatten results if nested
            if results and isinstance(results[0], list):
                results = results[0]
            
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Error searching businesses: {str(e)}")
            # Return mock data as fallback
            return self._get_mock_businesses(query, location, limit)
    
    async def get_business_reviews(
        self,
        place_id: str = None,
        business_name: str = None,
        reviews_limit: int = 20,
        sort: str = 'most_relevant'
    ) -> Dict[str, Any]:
        """
        Get reviews for a specific business
        
        Args:
            place_id: Google Maps place ID
            business_name: Business name (alternative to place_id)
            reviews_limit: Maximum number of reviews
            sort: Sort order ('most_relevant', 'newest', 'highest_rating', 'lowest_rating')
            
        Returns:
            Business data with reviews
        """
        if not self.is_configured:
            logger.error("Outscraper service not configured")
            return self._get_mock_reviews(place_id or business_name)
        
        try:
            query = place_id if place_id else business_name
            if not query:
                raise ValueError("Either place_id or business_name is required")
            
            logger.info(f"Fetching reviews for: {query}")
            
            results = self.client.google_maps_reviews(
                query=query,
                reviews_limit=reviews_limit,
                sort=sort,
                language='en'
            )
            
            if results and len(results) > 0:
                return results[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching reviews: {str(e)}")
            # Return mock data as fallback
            return self._get_mock_reviews(place_id or business_name)
    
    async def get_business_details(
        self,
        place_id: str
    ) -> Dict[str, Any]:
        """
        Get detailed information about a business
        
        Args:
            place_id: Google Maps place ID
            
        Returns:
            Detailed business information
        """
        if not self.is_configured:
            logger.error("Outscraper service not configured")
            return self._get_mock_business_details(place_id)
        
        try:
            logger.info(f"Fetching business details for: {place_id}")
            
            results = self.client.google_maps_search(
                query=place_id,
                limit=1,
                language='en'
            )
            
            if results and len(results) > 0:
                if isinstance(results[0], list) and len(results[0]) > 0:
                    return results[0][0]
                return results[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching business details: {str(e)}")
            return self._get_mock_business_details(place_id)
    
    # Mock data methods for development/testing
    def _get_mock_businesses(self, query: str, location: str, limit: int) -> List[Dict[str, Any]]:
        """Generate mock business data for testing"""
        mock_businesses = [
            {
                "place_id": "mock_place_1",
                "name": f"Mock {query.title()} 1",
                "address": f"123 Main St, {location or 'City'}",
                "rating": 4.5,
                "reviews": 150,
                "phone": "(555) 123-4567",
                "website": "https://example.com",
                "type": query
            },
            {
                "place_id": "mock_place_2",
                "name": f"Mock {query.title()} 2",
                "address": f"456 Oak Ave, {location or 'City'}",
                "rating": 4.2,
                "reviews": 89,
                "phone": "(555) 234-5678",
                "website": "https://example2.com",
                "type": query
            },
            {
                "place_id": "mock_place_3",
                "name": f"Mock {query.title()} 3",
                "address": f"789 Pine Rd, {location or 'City'}",
                "rating": 4.8,
                "reviews": 203,
                "phone": "(555) 345-6789",
                "type": query
            }
        ]
        return mock_businesses[:limit]
    
    def _get_mock_reviews(self, business_id: str) -> Dict[str, Any]:
        """Generate mock review data for testing"""
        return {
            "place_id": business_id,
            "name": f"Business {business_id}",
            "rating": 4.5,
            "reviews": 150,
            "reviews_data": [
                {
                    "author_title": "John Doe",
                    "author_reviews_count": 25,
                    "author_photo": None,
                    "review_rating": 5,
                    "review_datetime_utc": "2024-01-15T10:30:00Z",
                    "review_text": "Excellent service! The API key configuration message shows this is mock data. Get your Outscraper API key to see real reviews.",
                    "owner_answer": "Thank you for your feedback!"
                },
                {
                    "author_title": "Jane Smith",
                    "author_reviews_count": 42,
                    "author_photo": None,
                    "review_rating": 4,
                    "review_datetime_utc": "2024-01-10T15:45:00Z",
                    "review_text": "Good experience overall. This is mock data - configure OUTSCRAPER_API_KEY to see real reviews.",
                    "owner_answer": None
                }
            ]
        }
    
    def _get_mock_business_details(self, place_id: str) -> Dict[str, Any]:
        """Generate mock business details for testing"""
        return {
            "place_id": place_id,
            "name": f"Mock Business {place_id}",
            "address": "123 Main Street, City, State 12345",
            "phone": "(555) 123-4567",
            "website": "https://example.com",
            "rating": 4.5,
            "reviews": 150,
            "price_level": 2,
            "opening_hours": {
                "Monday": "9:00 AM - 5:00 PM",
                "Tuesday": "9:00 AM - 5:00 PM",
                "Wednesday": "9:00 AM - 5:00 PM",
                "Thursday": "9:00 AM - 5:00 PM",
                "Friday": "9:00 AM - 5:00 PM",
                "Saturday": "10:00 AM - 3:00 PM",
                "Sunday": "Closed"
            }
        }