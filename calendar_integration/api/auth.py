# api/auth.py
import os
from functools import wraps
from flask import request, jsonify
from calendar_integration.utils.logger import get_logger
from typing import Optional

logger = get_logger(__name__)

# Simple in-memory user store (in production, use a proper database)
USERS = {
    "user1": {"password": "password123", "interests": ["technology", "programming"]},
    "user2": {"password": "password456", "interests": ["sports", "fitness"]},
}

def validate_user(user_id: Optional[str], password: Optional[str] = None) -> bool:
    """Validate user credentials."""
    if not user_id or user_id not in USERS:
        return False
    
    if password and USERS[user_id]["password"] != password:
        return False
    
    return True

def get_user_interests(user_id: str) -> list:
    """Get user interests."""
    if user_id in USERS:
        return USERS[user_id].get("interests", [])
    return []

def require_auth(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = request.args.get('user_id')
        password = request.headers.get('X-API-Key')  # Using API key as password
        
        if not validate_user(user_id, password):
            logger.warning(f"Authentication failed for user: {user_id}")
            return jsonify({"error": "Authentication required", "status": "error"}), 401
        
        logger.info(f"Authentication successful for user: {user_id}")
        return f(*args, **kwargs)
    
    return decorated_function

def require_user_id(f):
    """Decorator to require user_id parameter."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = request.args.get('user_id')
        
        if not user_id or not user_id.strip():
            logger.warning("Missing or empty user_id parameter")
            return jsonify({"error": "user_id is required", "status": "error"}), 400
        
        return f(*args, **kwargs)
    
    return decorated_function 