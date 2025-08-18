"""
API routes for Outscraper integration
"""
import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional

from .models import (
    BusinessSearchRequest,
    BusinessSearchResponse,
    ReviewsRequest,
    ReviewsResponse,
    BusinessDetailsRequest,
    BusinessDetailsResponse
)
from .outscraper_service import OutscraperService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/outscraper", tags=["outscraper"])

# Initialize service with better error handling
outscraper_service = None
try:
    outscraper_service = OutscraperService()
    service_status = outscraper_service.check_availability()
    if not service_status["available"]:
        logger.warning(f"Outscraper service not fully available: {service_status}")
except Exception as e:
    logger.error(f"Failed to initialize Outscraper service: {e}")


@router.post("/search", response_model=BusinessSearchResponse)
async def search_businesses(request: BusinessSearchRequest):
    """Search for businesses using Outscraper"""
    if not outscraper_service:
        # Return mock data with a warning
        logger.warning("Outscraper service not initialized, returning mock data")
        return BusinessSearchResponse(
            success=True,
            businesses=[
                {
                    "place_id": "config_required",
                    "name": "⚠️ Outscraper API Key Required",
                    "address": "Please configure OUTSCRAPER_API_KEY in your .env file",
                    "rating": 0,
                    "reviews": 0,
                    "website": "https://outscraper.com",
                    "phone": "Get your API key at outscraper.com"
                }
            ],
            total_count=1
        )
    
    try:
        businesses = await outscraper_service.search_businesses(
            query=request.query,
            location=request.location,
            limit=request.limit
        )
        
        return BusinessSearchResponse(
            businesses=businesses,
            total_count=len(businesses)
        )
        
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reviews", response_model=ReviewsResponse)
async def get_reviews(request: ReviewsRequest):
    """Get reviews for a specific business"""
    if not outscraper_service:
        raise HTTPException(
            status_code=503,
            detail="Outscraper service is not available. Please configure OUTSCRAPER_API_KEY."
        )
    
    if not request.place_id and not request.business_name:
        raise HTTPException(
            status_code=400,
            detail="Either place_id or business_name is required"
        )
    
    try:
        result = await outscraper_service.get_business_reviews(
            place_id=request.place_id,
            business_name=request.business_name,
            reviews_limit=request.reviews_limit,
            sort=request.sort
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Business not found")
        
        reviews = result.get('reviews_data', [])
        business_info = {k: v for k, v in result.items() if k != 'reviews_data'}
        
        return ReviewsResponse(
            business_info=business_info,
            reviews=reviews,
            total_reviews=len(reviews)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reviews error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/details", response_model=BusinessDetailsResponse)
async def get_business_details(request: BusinessDetailsRequest):
    """Get detailed information about a business"""
    if not outscraper_service:
        raise HTTPException(
            status_code=503,
            detail="Outscraper service is not available. Please configure OUTSCRAPER_API_KEY."
        )
    
    try:
        details = await outscraper_service.get_business_details(
            place_id=request.place_id
        )
        
        if not details:
            raise HTTPException(status_code=404, detail="Business not found")
        
        return BusinessDetailsResponse(details=details)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Details error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Check if Outscraper service is configured and healthy"""
    if not outscraper_service:
        return {
            "status": "error",
            "configured": False,
            "message": "Outscraper service failed to initialize"
        }
    
    availability = outscraper_service.check_availability()
    
    if availability["available"]:
        return {
            "status": "healthy",
            "configured": True,
            "details": availability
        }
    else:
        return {
            "status": "unhealthy",
            "configured": availability["has_api_key"],
            "details": availability,
            "message": "Outscraper API key missing or invalid. Add OUTSCRAPER_API_KEY to your .env file."
        }


@router.get("/config-help")
async def config_help():
    """Get configuration help for Outscraper"""
    return {
        "steps": [
            "1. Sign up for an Outscraper account at https://outscraper.com",
            "2. Get your API key from the dashboard",
            "3. Add OUTSCRAPER_API_KEY=your_key_here to your .env file",
            "4. Restart the application",
            "5. The review search should now work with real data"
        ],
        "documentation": "https://docs.outscraper.com",
        "pricing": "https://outscraper.com/pricing"
    }