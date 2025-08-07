"""
High-level calendar façade that hides the storage backend.

Public API
----------
CalendarClient.list_events(user_id)                 -> list[dict]
CalendarClient.create_event(payload)                -> dict
CalendarClient.update_event(event_id, payload)      -> dict
CalendarClient.delete_event(event_id)               -> None
CalendarClient.batch_upsert(events: list[dict])     -> dict[result]
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

log = logging.getLogger("pitext_calendar.calendar_client")


class CalendarClient:
    """Thread-safe singleton for event persistence."""

    def __init__(self, driver: str | None = None) -> None:
        # `driver` string lets you switch back-end (json, sql, redis, etc.)
        from ._storage import build_storage  # local import to avoid cycles

        self.storage = build_storage(driver or "json")  # type: ignore[arg-type]

    # -----------------------------------------------------------------
    # CRUD interface
    # -----------------------------------------------------------------
    def list_events(self, user_id: str | None) -> List[Dict[str, Any]]:
        return self.storage.fetch_all(user_id=user_id)

    def create_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        event = self.storage.insert(payload)
        log.info("Created event %s", event["event_id"])
        return event

    def update_event(
        self, event_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        event = self.storage.update(event_id, payload)
        log.info("Updated event %s", event_id)
        return event

    def delete_event(self, event_id: str) -> None:
        self.storage.delete(event_id)
        log.info("Deleted event %s", event_id)

    # -----------------------------------------------------------------
    # Bulk insert / update
    # -----------------------------------------------------------------
    def batch_upsert(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.storage.batch_upsert(events)

    # -----------------------------------------------------------------
    # Backward compatibility methods
    # -----------------------------------------------------------------
    def fetch_events(self, user_id: str) -> List[Dict[str, Any]]:
        """Backward compatibility method."""
        return self.list_events(user_id)

    def batch_create_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Backward compatibility method."""
        result = self.batch_upsert(events)
        return result.get("created", []) 