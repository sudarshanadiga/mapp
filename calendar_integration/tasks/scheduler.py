"""
Thin wrapper around the `schedule` library.

Runs tasks in a background thread; meant to be called
once during application start-up.

No web-framework or OS-specific code lives here.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Callable

import schedule

from .daily import create_daily_reminders
from .weekly import create_weekly_events
from .weather import create_weather_events

log = logging.getLogger("pitext_calendar.scheduler")


def _run_forever() -> None:
    """Blocking loop executed inside a daemon thread."""
    while True:
        schedule.run_pending()
        time.sleep(1)  # 1-second granularity is fine for calendar jobs


def _register_tasks() -> None:
    """Attach jobs to the global scheduler object."""
    schedule.every().day.at("00:05").do(create_daily_reminders)
    schedule.every().monday.at("00:10").do(create_weekly_events)
    schedule.every().day.at("06:00").do(create_weather_events)  # Fetch weather data daily
    log.info("Scheduled daily + weekly + weather background jobs")


def start_scheduler(*, start_thread: bool = True) -> None:
    """
    Initialise the scheduler.
    If `start_thread` is False, the caller can run `_run_forever()` manually.
    """
    _register_tasks()
    if start_thread:
        thread = threading.Thread(target=_run_forever, name="scheduler", daemon=True)
        thread.start()
 