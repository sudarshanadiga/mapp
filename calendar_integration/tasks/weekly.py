"""
Weekly maintenance job.

* Auto-creates routine events for the coming week.
* Delegates persistence to CalendarClient so no DB code appears here.
"""

from __future__ import annotations

import datetime as _dt
import logging
from typing import Dict, List

from ..services.calendar_client import CalendarClient

log = logging.getLogger("pitext_calendar.tasks.weekly")

client = CalendarClient()


# ---------------------------------------------------------------------
# Public entry-point (called by scheduler)
# ---------------------------------------------------------------------
def create_weekly_events() -> None:
    """
    Generate standard weekly events for every active user.
    Safe to call multiple times; CalendarClient handles idempotency.
    """
    users: List[str] = _fetch_active_user_ids()
    for uid in users:
        _safe_create(uid)
    log.info("Weekly events job completed for %d users", len(users))


# ---------------------------------------------------------------------
# Helpers (internal)
# ---------------------------------------------------------------------
def _fetch_active_user_ids() -> List[str]:
    # Replace with actual persistence (e.g. SQL SELECT)
    return ["user_demo"]


def _safe_create(user_id: str) -> None:
    base_date = _dt.date.today() + _dt.timedelta(days=1)  # start tomorrow
    template: Dict = {
        "duration_minutes": 30,
        "type": "maintenance",
        "user_id": user_id,
    }

    for i in range(7):  # next 7 days
        payload = template | {
            "title": "Daily reflection",
            "start_time": _combine(base_date + _dt.timedelta(days=i), hour=22).isoformat(),
        }
        try:
            client.create_event(payload)
        except Exception as exc:
            log.warning("Skipping duplicate or invalid event: %s", exc)


def _combine(date: _dt.date, *, hour: int) -> _dt.datetime:
    return _dt.datetime.combine(date, _dt.time(hour=hour)) 