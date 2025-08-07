"""
Lightweight validation helpers.

These are pure Python utilities—no Pydantic, Marshmallow or Flask.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Iterable, Mapping


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def is_email(value: str) -> bool:
    return bool(_EMAIL_RE.fullmatch(value))


def require_keys(mapping: Mapping, keys: Iterable[str]) -> None:
    """
    Raise ValueError if any key is missing.
    Useful for validating incoming dict payloads.
    """
    missing = [k for k in keys if k not in mapping]
    if missing:
        raise ValueError(f"Missing keys: {', '.join(missing)}")


def require_iso_datetime(value: str) -> None:
    try:
        datetime.fromisoformat(value)
    except Exception as exc:
        raise ValueError("Not a valid ISO-8601 datetime") from exc


def validate_event_data(event_data: dict, is_creation: bool = False):
    """Validate calendar event data."""
    if is_creation:
        required_fields = ['title', 'start_time', 'end_time']
        missing_fields = [field for field in required_fields if field not in event_data]

        if missing_fields:
            raise ValueError(f"Missing required event fields: {', '.join(missing_fields)}")

    # This validation should only run if both fields are present in the payload
    if 'start_time' in event_data and 'end_time' in event_data:
        start_time = event_data.get('start_time')
        end_time = event_data.get('end_time')

        if start_time is None or end_time is None:
            raise ValueError("If provided, 'start_time' and 'end_time' must not be None.")

        if start_time >= end_time:
            raise ValueError("Event 'end_time' must be after 'start_time'.")

    return True
# Validation Functions 