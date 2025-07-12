"""
Google OAuth routes (PKCE).

Public routes
-------------
GET /calendar/oauth/google/start
GET /calendar/oauth/google/callback
"""

from __future__ import annotations

import logging
import secrets
import os
import json
from urllib.parse import urlencode
from pathlib import Path

from flask import Blueprint, current_app, redirect, request, session, url_for

from calendar_integration.services.google_calendar_client import GoogleCalendarClient
from calendar_integration.api._helpers import err, ok

oauth_bp = Blueprint("oauth_google", __name__)

log = logging.getLogger("pitext_calendar.oauth")

# Test route to confirm blueprint registration
@oauth_bp.get("/oauth/test")
def test():
    return 'OAuth blueprint is working!'

# ---------------------------------------------------------------------
# Step 1: redirect user to Google consent page
# ---------------------------------------------------------------------
@oauth_bp.get("/oauth/google/start")
def oauth_start():
    current_app.logger.info('Google OAuth start endpoint called')
    google_auth_base = 'https://accounts.google.com/o/oauth2/v2/auth'
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    if not client_id:
        current_app.logger.error('GOOGLE_CLIENT_ID not set')
        return 'Google OAuth is not configured. Please contact support.', 500
    # Use url_for to generate the callback URI
    redirect_uri = url_for('calendar_api.oauth_google.oauth_callback', _external=True)
    scope = 'https://www.googleapis.com/auth/calendar.readonly'
    state = secrets.token_urlsafe(16)
    session['google_oauth_state'] = state
    session.modified = True

    params = {
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': scope,
        'access_type': 'offline',
        'prompt': 'consent',
        'state': state
    }
    consent_url = f"{google_auth_base}?{urlencode(params)}"
    current_app.logger.info(f'Redirecting to Google OAuth: {consent_url}')
    return redirect(consent_url)

# ---------------------------------------------------------------------
# Step 2: Google redirects back here with code
# ---------------------------------------------------------------------
@oauth_bp.get("/oauth/google/callback")
def oauth_callback():
    current_app.logger.info('Google OAuth callback endpoint called')
    state = request.args.get('state')
    if not state or state != session.get('google_oauth_state'):
        current_app.logger.error('Invalid state parameter')
        return 'Invalid state parameter', 400

    code = request.args.get('code')
    if not code:
        current_app.logger.error('Missing code parameter')
        return 'Missing code parameter', 400

    token_url = 'https://oauth2.googleapis.com/token'
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    redirect_uri = url_for('calendar_api.oauth_google.oauth_callback', _external=True)

    data = {
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }
    try:
        import requests
        resp = requests.post(token_url, data=data)
        resp.raise_for_status()
        tokens = resp.json()
        current_app.logger.info(f'Token exchange successful: {tokens}')
        # Store tokens in google_tokens.json by user_id (from session or fallback)
        user_id = session.get('user_id', 'demo_user')
        token_path = os.path.join(os.path.dirname(__file__), '..', 'google_tokens.json')
        try:
            with open(token_path, 'r') as f:
                token_data = json.load(f)
        except Exception:
            token_data = {}
        token_data[user_id] = tokens
        with open(token_path, 'w') as f:
            json.dump(token_data, f, indent=2)
        # Also write to ~/.pitext/google_tokens/{user_id}.json for GoogleCalendarClient
        token_dir = Path.home() / ".pitext" / "google_tokens"
        token_dir.mkdir(parents=True, exist_ok=True)
        with open(token_dir / f"{user_id}.json", "w") as f2:
            json.dump(tokens, f2, indent=2)
        # Redirect to calendar page with success indicator
        return redirect(url_for('calendar_api.events.index', google_import='success'))
    except Exception as e:
        current_app.logger.error(f'Failed to exchange code for tokens: {e}')
        return f'Failed to exchange code for tokens: {e}', 500 