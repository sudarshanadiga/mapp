"""
Daily reminder generator.

Creates same-day reminders for time-sensitive events
(e.g. send an email two hours before a scheduled meeting).
"""

from __future__ import annotations

import datetime as _dt
import logging
from typing import Dict, List

from ..services.calendar_client import CalendarClient

log = logging.getLogger("pitext_calendar.tasks.daily")

client = CalendarClient()


def create_daily_reminders() -> None:
    """
    Scan today's events and add reminder entries where appropriate.
    """
    today = _dt.date.today()
    events = client.list_events(user_id=None)  # all users
    targets = [ev for ev in events if _is_today(ev, today)]

    for ev in targets:
        _maybe_create_reminder(ev)

    log.info("Daily reminder job processed %d events", len(targets))


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def _is_today(event: Dict, today: _dt.date) -> bool:
    try:
        start = _dt.datetime.fromisoformat(event["start_time"])
    except Exception:
        return False
    return start.date() == today


def _maybe_create_reminder(event: Dict) -> None:
    # Only create if no existing reminder exists
    reminder_title = f"Reminder: {event['title']}"
    existing = [
        e for e in client.list_events(event["user_id"])
        if e.get("title") == reminder_title
    ]
    if existing:
        return

    reminder_payload = {
        "title": reminder_title,
        "start_time": (
            _dt.datetime.fromisoformat(event["start_time"]) - _dt.timedelta(hours=2)
        ).isoformat(),
        "duration_minutes": 15,
        "user_id": event["user_id"],
        "type": "reminder",
        "metadata": {"source_event": event.get("event_id", event.get("id", "unknown"))},
    }
    client.create_event(reminder_payload) 