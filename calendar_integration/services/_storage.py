"""
Storage backend abstraction for calendar events.
Currently implements JSON file storage, but can be extended to support
SQL databases, Redis, etc.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Any, Dict, List

from ..utils.datetime import parse_datetime

logger = logging.getLogger(__name__)


class JSONStorage:
    """Simple JSON file-based storage backend."""
    
    def __init__(self, file_path: str = "calendar_events.json"):
        self.file_path = file_path
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        """Create the JSON file if it doesn't exist."""
        if not os.path.exists(self.file_path):
            with open(self.file_path, 'w') as f:
                json.dump([], f)
            logger.info(f"Created events file: {self.file_path}")
    
    def _load_events(self) -> List[Dict[str, Any]]:
        """Load events from JSON file."""
        logger.info(f"Loading events from {self.file_path}")
        try:
            if os.path.exists(self.file_path):
                logger.info(f"Events file exists, size: {os.path.getsize(self.file_path)} bytes")
                with open(self.file_path, 'r') as f:
                    content = f.read()
                    logger.debug(f"File content (first 200 chars): {content[:200]}")
                    if not content.strip():
                        logger.warning("Events file is empty")
                        return []
                    events_data = json.loads(content)
                    logger.info(f"Loaded {len(events_data)} events from file")
                    # DO NOT convert date strings to datetime objects here! Keep as ISO strings for frontend compatibility.
                    return events_data
            else:
                logger.warning(f"Events file does not exist: {self.file_path}")
                return []
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse events file (corrupted JSON): {e}")
            # Backup corrupted file and create new one
            try:
                backup_file = f"{self.file_path}.backup.{int(datetime.now().timestamp())}"
                os.rename(self.file_path, backup_file)
                logger.info(f"Backed up corrupted file to: {backup_file}")
            except Exception as backup_error:
                logger.error(f"Failed to backup corrupted file: {backup_error}")
            return []
        except Exception as e:
            logger.error(f"Failed to load events from file: {e}")
            return []
    
    def _save_events(self, events: List[Dict[str, Any]]):
        """Save events to JSON file."""
        try:
            # Convert datetime objects to strings for JSON serialization
            events_to_save = []
            for event in events:
                event_copy = event.copy()
                # Handle all datetime fields
                datetime_fields = ['start_time', 'end_time', 'created', 'last_modified']
                for field in datetime_fields:
                    if isinstance(event_copy.get(field), datetime):
                        # Ensure timezone-aware ISO format for FullCalendar
                        dt = event_copy[field]
                        if dt.tzinfo is None:
                            # Add Eastern timezone if naive datetime (matching calendar config)
                            dt = dt.replace(tzinfo=ZoneInfo("America/New_York"))
                        event_copy[field] = dt.isoformat()
                events_to_save.append(event_copy)
            # Debug: log what we're saving
            logger.info(f"Saving {len(events_to_save)} events to {self.file_path}")
            with open(self.file_path, 'w') as f:
                json.dump(events_to_save, f, indent=2)
            # Verify the file was written
            if os.path.exists(self.file_path):
                file_size = os.path.getsize(self.file_path)
                logger.info(f"Events file written successfully, size: {file_size} bytes")
        except Exception as e:
            logger.error(f"Failed to save events to file: {e}")
            raise
    
    def fetch_all(self, user_id: str | None = None) -> List[Dict[str, Any]]:
        """Fetch all events, optionally filtered by user_id."""
        events = self._load_events()
        
        # First, fix any events with missing user_id and save changes
        needs_save = False
        for event in events:
            if event.get('user_id') is None:
                event['user_id'] = 'default_user'
                needs_save = True
        
        if needs_save:
            logger.info("Fixed events with missing user_id, saving to file")
            self._save_events(events)
        
        if user_id:
            filtered_events = [
                event for event in events 
                if str(event.get('user_id', '')).strip() == str(user_id).strip()
            ]
            logger.info(f"Filtered {len(events)} events to {len(filtered_events)} for user: {user_id}")
            return filtered_events
        
        return events
    
    def insert(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a new event."""
        events = self._load_events()
        
        # Generate unique event ID
        import uuid
        event_id = str(uuid.uuid4())
        
        # Create event with metadata
        from zoneinfo import ZoneInfo
        eastern = ZoneInfo("America/New_York")
        event = {
            'created': datetime.now(tz=eastern),
            'last_modified': datetime.now(tz=eastern),
            **payload,
            'event_id': event_id,  # Put this AFTER payload to override empty string
        }
        
        # Guarantee a non-empty eventType
        event["eventType"] = event.get("eventType", "other") or "other"
        
        events.append(event)
        self._save_events(events)
        return event
    
    def update(self, event_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing event."""
        events = self._load_events()
        
        for i, event in enumerate(events):
            if event.get('event_id') == event_id:
                events[i].update(payload)
                eastern = ZoneInfo("America/New_York")
                events[i]['last_modified'] = datetime.now(tz=eastern)
                self._save_events(events)
                return events[i]
        
        raise ValueError(f"Event not found: {event_id}")
    
    def delete(self, event_id: str):
        """Delete an event."""
        events = self._load_events()
        events = [event for event in events if event.get('event_id') != event_id]
        self._save_events(events)
    
    def batch_upsert(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Batch insert/update events."""
        created = []
        errors = []
        
        for i, data in enumerate(events):
            try:
                if 'event_id' in data:
                    # Update existing event
                    updated_event = self.update(data['event_id'], data)
                    created.append(updated_event)
                else:
                    # Create new event
                    new_event = self.insert(data)
                    created.append(new_event)
            except Exception as e:
                errors.append(f"Event {i}: {str(e)}")
        
        return {
            "created": created,
            "errors": errors,
            "message": f"Processed {len(created)} events with {len(errors)} errors"
        }


def build_storage(driver: str) -> JSONStorage:
    """Factory function to create storage backends."""
    if driver == "json":
        return JSONStorage()
    else:
        raise ValueError(f"Unknown storage driver: {driver}") 