"""
Prompt factory for the Event Echo feature.
Keeps all wording templates in one file so they can be tuned
without touching network or parsing code.
"""

from __future__ import annotations

from pathlib import Path
from string import Template

_BASE_DIR = Path(__file__).parent
_PROMPT_FILE = _BASE_DIR / "templates" / "echo_prompt.tmpl"

_DEFAULT_TEMPLATE = Template(
    """You are an assistant that proposes follow-up calendar events.
Seed event ID: $event_id
Output JSON with keys: title, offset_days, duration_minutes."""
)

# preload file template if exists
_PROMPT_TMPL: Template
try:
    _PROMPT_TMPL = Template(_PROMPT_FILE.read_text(encoding="utf-8"))
except FileNotFoundError:
    _PROMPT_TMPL = _DEFAULT_TEMPLATE


def build_prompt(
    seed_event_id: str,
    mermaid_only: bool = False,
) -> str:
    if mermaid_only:
        return (
            "Produce only Mermaid flowchart, no prose. "
            f"Seed event ID: {seed_event_id}"
        )
    return _PROMPT_TMPL.safe_substitute(event_id=seed_event_id) 