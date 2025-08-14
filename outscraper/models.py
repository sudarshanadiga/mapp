"""
Pydantic models for Outscraper integration
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class BusinessSearchRequest(BaseModel):
    """Request model for business search"""
    query: str = Field(..., description="Search query (e.g., restaurants, coffee shops)")
    location: Optional[str] = Field(None, description="Location to search in")
    limit: int = Field(20, ge=1, le=100, description="Maximum number of results")


class ReviewsRequest(BaseModel):
    """Request model for fetching reviews"""
    place_id: Optional[str] = Field(None, description="Google Maps place ID")
    business_name: Optional[str] = Field(None, description="Business name")
    reviews_limit: int = Field(20, ge=1, le=100, description="Maximum number of reviews")
    sort: str = Field(
        "most_relevant",
        regex="^(most_relevant|newest|highest_rating|lowest_rating)$",
        description="Sort order for reviews"
    )


class BusinessDetailsRequest(BaseModel):
    """Request model for business details"""
    place_id: str = Field(..., description="Google Maps place ID")


class BusinessSearchResponse(BaseModel):
    """Response model for business search"""
    success: bool = True
    businesses: List[Dict[str, Any]]
    total_count: int


class ReviewsResponse(BaseModel):
    """Response model for reviews"""
    success: bool = True
    business_info: Dict[str, Any]
    reviews: List[Dict[str, Any]]
    total_reviews: int


class BusinessDetailsResponse(BaseModel):
    """Response model for business details"""
    success: bool = True
    details: Dict[str, Any]