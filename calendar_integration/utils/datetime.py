"""
Datetime helpers with no external deps.

All functions work with stdlib `datetime` and `zoneinfo`.
"""

from __future__ import annotations

import datetime as _dt
from typing import Final, Tuple
from zoneinfo import ZoneInfo

_EASTERN: Final[ZoneInfo] = ZoneInfo("America/New_York")


# ---------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------
def parse_iso(value: str, *, assume_tz: str | None = "America/New_York") -> _dt.datetime:
    """
    Robust ISO-8601 parser.
    * If value lacks timezone, attach `assume_tz` (default local).
    * Return aware datetime.
    """
    dt = _dt.datetime.fromisoformat(value)
    if dt.tzinfo is None:
        tz = ZoneInfo(assume_tz) if assume_tz else _dt.datetime.now().astimezone().tzinfo
        dt = dt.replace(tzinfo=tz)
    return dt


def to_eastern(dt: _dt.datetime) -> _dt.datetime:
    """Convert aware datetime to US Eastern."""
    return dt.astimezone(_EASTERN)


# ---------------------------------------------------------------------
# Convenience shortcuts
# ---------------------------------------------------------------------
def now_utc() -> _dt.datetime:
    return _dt.datetime.now(tz=_dt.timezone.utc)


def today_range(tz: str = "UTC") -> Tuple[_dt.datetime, _dt.datetime]:
    """
    Return (start, end) datetimes for today in given timezone.
    """
    zone = ZoneInfo(tz)
    midnight = _dt.datetime.now(zone).replace(hour=0, minute=0, second=0, microsecond=0)
    return (midnight, midnight + _dt.timedelta(days=1))


# ---------------------------------------------------------------------
# Backward compatibility
# ---------------------------------------------------------------------
def parse_datetime(date_str: str):
    """Parse datetime string in various formats including ISO format.

    Naive datetimes are assumed to be in US Eastern time.
    """
    if not date_str:
        raise ValueError("Date string cannot be empty")
    
    # Try ISO format first (what JavaScript typically sends)
    try:
        return _dt.datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        pass
    
    # Try common datetime formats
    formats = [
        "%Y-%m-%dT%H:%M:%S.%fZ",  # ISO with milliseconds and Z
        "%Y-%m-%dT%H:%M:%S.%f",   # ISO with milliseconds
        "%Y-%m-%dT%H:%M:%SZ",     # ISO with Z
        "%Y-%m-%dT%H:%M:%S",      # ISO without timezone
        "%Y-%m-%d %H:%M:%S",      # Space separated
        "%Y-%m-%d",               # Date only
    ]
    
    for fmt in formats:
        try:
            dt = _dt.datetime.strptime(date_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=ZoneInfo("America/New_York"))
            return dt
        except ValueError:
            continue
    
    # If all formats fail, try to clean up the string and parse
    # Remove timezone info and try again
    import re
    cleaned_str = re.sub(r'[+-]\d{2}:?\d{2}$', '', date_str)
    cleaned_str = cleaned_str.replace('Z', '')
    
    try:
        dt = _dt.datetime.fromisoformat(cleaned_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=ZoneInfo("America/New_York"))
        return dt
    except ValueError:
        pass
    
    raise ValueError(f"Unable to parse date string: {date_str}. Expected ISO format or standard datetime format.") 