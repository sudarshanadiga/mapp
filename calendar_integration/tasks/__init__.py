# tasks/__init__.py
"""
Task package public interface.

Typical usage
-------------
from pitext_calendar.tasks import start_scheduler
start_scheduler()
"""

from .scheduler import start_scheduler              # scheduler entry-point
from .weekly import create_weekly_events            # convenience re-exports
from .daily import create_daily_reminders

__all__ = [
    "start_scheduler",
    "create_weekly_events",
    "create_daily_reminders",
]
