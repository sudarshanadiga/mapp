"""
Parses OpenAI responses into structured follow-up events or Mermaid code.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

log = logging.getLogger("pitext_calendar.echo_parser")


class EchoParser:
    """Convert raw LLM output to domain objects."""

    # -----------------------------------------------------------------
    # Events
    # -----------------------------------------------------------------
    def to_events(
        self, raw: str, user_id: str | None = None
    ) -> List[Dict[str, Any]]:
        try:
            parsed = json.loads(raw)
            assert isinstance(parsed, list)
        except Exception as exc:
            log.error("Cannot parse events JSON: %s", exc)
            raise ValueError("Bad event JSON") from exc

        for ev in parsed:
            ev.setdefault("user_id", user_id)
        return parsed  # type: ignore[return-value]

    # -----------------------------------------------------------------
    # Mermaid
    # -----------------------------------------------------------------
    def to_mermaid(self, raw: str) -> str:
        # allow either code-block fenced or plain
        lines = raw.strip().splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        return "\n".join(lines) 