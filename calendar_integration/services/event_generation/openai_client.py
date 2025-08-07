"""
Thin wrapper around OpenAI Chat Completions.

The goal is to isolate any vendor SDK logic so
the rest of the codebase remains import-free.
"""

from __future__ import annotations

import logging
import os
from typing import Dict

from openai import OpenAI

log = logging.getLogger("pitext_calendar.openai_client")


class ChatCompletionClient:
    """Very small abstraction over openai.ChatCompletion.create"""

    def __init__(self, model: str = "gpt-4.1") -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set")
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def chat(self, prompt: str) -> str:
        log.debug("Calling OpenAI, model=%s, prompt=%s", self.model, prompt[:80])
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        content = response.choices[0].message.content
        if content is None:
            raise RuntimeError("OpenAI returned empty response")
        return content 