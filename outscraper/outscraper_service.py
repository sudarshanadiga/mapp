"""
Outscraper service integration for business and review data
"""
import os
import logging
from typing import List, Dict, Any, Optional
from outscraper import ApiClient

logger = logging.getLogger(__name__)


class OutscraperService:
    """Service for interacting with Outscraper API"""
    
    def __init__(self):
        self.api_key = os.getenv('OUTSCRAPER_API_KEY')
        if not self.api_key:
            raise ValueError("OUTSCRAPER_API_KEY environment variable is required")
        
        self.client = ApiClient(api_key=self.api_key)
    
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
            raise
    
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
            raise
    
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
            raise