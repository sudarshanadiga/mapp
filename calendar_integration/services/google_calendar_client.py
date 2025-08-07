"""
Minimal Google Calendar API wrapper (OAuth token exchanged elsewhere).

Only the subset needed by the app is implemented.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict

import google.auth.transport.requests
import google.oauth2.credentials
import googleapiclient.discovery

log = logging.getLogger("pitext_calendar.google_client")

_TOKEN_DIR = Path.home() / ".pitext" / "google_tokens"
_TOKEN_DIR.mkdir(parents=True, exist_ok=True)


class GoogleCalendarClient:
    """Handles URL generation, token exchange, and simple event ops."""

    SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

    def __init__(self) -> None:
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        if not self.client_id or not self.client_secret:
            raise RuntimeError("Google OAuth env vars missing")

    # --------------------------------------------------------------
    # OAuth helpers
    # --------------------------------------------------------------
    def get_authorize_url(self, state: str) -> str:
        from google_auth_oauthlib.flow import Flow

        flow = Flow.from_client_config(
            {
                "installed": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=self.SCOPES,
            state=state,
        )
        return flow.authorization_url(prompt="consent")[0]

    def exchange_code(self, code: str) -> Dict:
        from google_auth_oauthlib.flow import Flow

        flow = Flow.from_client_config(
            {
                "installed": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=self.SCOPES,
        )
        flow.fetch_token(code=code)
        creds = flow.credentials
        return {
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
        }

    # --------------------------------------------------------------
    # High-level persistence
    # --------------------------------------------------------------
    def persist_tokens(self, user_id: str, tokens: Dict) -> None:
        token_path = _TOKEN_DIR / f"{user_id}.json"
        token_path.write_text(json.dumps(tokens, indent=2))
        log.info("Saved tokens for %s", user_id)

    # --------------------------------------------------------------
    # Example: insert an event directly on Google
    # --------------------------------------------------------------
    def insert_event(self, user_id: str, event_payload: Dict) -> Dict:
        creds = self._load_creds(user_id)
        service = googleapiclient.discovery.build(
            "calendar", "v3", credentials=creds, cache_discovery=False
        )
        result = service.events().insert(calendarId="primary", body=event_payload).execute()
        return result

    # --------------------------------------------------------------
    # Helpers
    # --------------------------------------------------------------
    def _load_creds(self, user_id: str):
        # First check the alternative location for any available token
        alt_token_path = Path(__file__).parent.parent / 'google_tokens.json'
        if alt_token_path.exists():
            try:
                with alt_token_path.open() as f:
                    all_tokens = json.load(f)
                
                # If we have tokens but not for this specific user, 
                # save the first available token for this user
                if all_tokens and user_id not in all_tokens:
                    # Get the first available token
                    available_user = list(all_tokens.keys())[0]
                    available_token = all_tokens[available_user]
                    
                    # Save it for the requested user
                    self.persist_tokens(user_id, available_token)
                    log.info(f"Copied token from {available_user} to {user_id}")
            except Exception as e:
                log.warning(f"Could not process alternative token file: {e}")
        
        # Now try to load from standard location
        token_path = _TOKEN_DIR / f"{user_id}.json"
        if not token_path.exists():
            raise RuntimeError(f"User {user_id} has not linked Google Calendar")
            
        with token_path.open() as f:
            data = json.load(f)
            
        creds = google.oauth2.credentials.Credentials(
            token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self.client_id,
            client_secret=self.client_secret,
            scopes=self.SCOPES,
        )
        
        if creds.expired and creds.refresh_token:
            creds.refresh(google.auth.transport.requests.Request())
            self.persist_tokens(user_id, {
                "access_token": creds.token,
                "refresh_token": creds.refresh_token,
                "expiry": creds.expiry.isoformat() if creds.expiry else None,
            })
        return creds

    def fetch_events(self, user_id: str, calendar_id='primary', time_min=None, time_max=None, max_results=100):
        # Fetch events from the user's Google Calendar
        creds = self._load_creds(user_id)
        service = googleapiclient.discovery.build(
            "calendar", "v3", credentials=creds, cache_discovery=False
        )
        from datetime import datetime
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min or datetime.utcnow().isoformat() + 'Z',
            timeMax=time_max,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        return events_result.get('items', []) 