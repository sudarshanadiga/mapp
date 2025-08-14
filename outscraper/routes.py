"""
API routes for Outscraper integration
"""
import logging
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

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

# Initialize service
try:
    outscraper_service = OutscraperService()
except ValueError as e:
    logger.error(f"Failed to initialize Outscraper service: {e}")
    outscraper_service = None


@router.post("/search", response_model=BusinessSearchResponse)
async def search_businesses(request: BusinessSearchRequest):
    """Search for businesses using Outscraper"""
    if not outscraper_service:
        raise HTTPException(
            status_code=503,
            detail="Outscraper service is not available. Please check API key configuration."
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
            detail="Outscraper service is not available. Please check API key configuration."
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
            detail="Outscraper service is not available. Please check API key configuration."
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
    """Check if Outscraper service is configured"""
    return {
        "status": "healthy" if outscraper_service else "unavailable",
        "configured": outscraper_service is not None
    }