"""
Orchestrates prompt creation, OpenAI completion, and parsing
to return AI-generated follow-up events plus Mermaid code.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

from .prompt_builder import build_prompt
from .openai_client import ChatCompletionClient
from .parser import EchoParser

log = logging.getLogger("pitext_calendar.echo_service")


@dataclass(slots=True)
class EventEchoService:
    """
    Glue object that the API layer calls.
    All network / AI calls happen here, not in the Flask code.
    """

    model: str = "gpt-4.1"
    openai: Any = field(init=False)
    parser: Any = field(init=False)

    def __post_init__(self) -> None:
        self.openai = ChatCompletionClient(model=self.model)
        self.parser = EchoParser()

    # --------------------------------------------------------------
    # Public API
    # --------------------------------------------------------------
    def generate_followups(
        self, user_id: str | None, seed_event_id: str
    ) -> List[Dict[str, Any]]:
        prompt = build_prompt(seed_event_id)
        completion = self.openai.chat(prompt)
        events = self.parser.to_events(completion, user_id=user_id)
        log.debug("Generated %d follow-ups", len(events))
        return events

    def mermaid_for_chain(self, seed_event_id: str) -> str:
        prompt = build_prompt(seed_event_id, mermaid_only=True)
        completion = self.openai.chat(prompt)
        mermaid = self.parser.to_mermaid(completion)
        return mermaid 