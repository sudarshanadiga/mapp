"""OpenAI Realtime WebSocket helper
===================================
A thin, asyncio‑friendly wrapper around the OpenAI Realtime API that:
    • opens one persistent WebSocket per user session
    • sends a *session.update* upon connect to configure modalities & voice
    • provides   push_pcm() / commit()  for streaming microphone audio
    • exposes   async for ev in client.events()   to consume server events

The class is deliberately transport‑agnostic: whatever part of your Flask
app owns the user’s Socket.IO connection can instantiate **RealtimeClient**
and stitch the two layers together.

Usage (inside a Socket.IO namespace):
-------------------------------------
client = RealtimeClient(api_key=OPENAI_KEY)
await client.connect()
...
await client.push_pcm(pcm_bytes)
...
async for event in client.events():
    process(event)
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import contextlib
from typing import AsyncGenerator, Dict, Optional

import websockets
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError

OPENAI_URL = os.getenv("OPENAI_REALTIME_URL", "wss://api.openai.com/v1/realtime")
DEFAULT_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-audio-preview")

# ---------------------------------------------------------------------------
# Helper — tiny base‑64 helper to avoid typing the same boilerplate
# ---------------------------------------------------------------------------
_b64encode = lambda b: base64.b64encode(b).decode()


class RealtimeClient:
    """Maintain a single WS connection to OpenAI Realtime."""

    def __init__(self, api_key: str, *, model: str = DEFAULT_MODEL):
        self._api_key = api_key
        self._model = model
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._ev_q: asyncio.Queue = asyncio.Queue()
        self._reader_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------
    async def connect(self) -> None:
        headers = {"Authorization": f"Bearer {self._api_key}"}
        self._ws = await websockets.connect(
            OPENAI_URL,
            extra_headers=headers,
            max_size=2 ** 22,   # 4 MiB – big enough for long responses
        )

        # Configure session (24 kHz PCM in/out, alloy voice)
        await self._send({
            "type": "session.update",
            "session": {
                "modalities": ["audio", "text"],
                "model": self._model,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "voice": {"name": "alloy"},
            },
        })

        # Spawn background reader
        self._reader_task = asyncio.create_task(self._reader())

    async def close(self) -> None:
        if self._ws and not self._ws.closed:
            await self._ws.close()
        if self._reader_task:
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._reader_task

    # ------------------------------------------------------------------
    # Public API – audio upload + event iterator
    # ------------------------------------------------------------------
    async def push_pcm(self, pcm_bytes: bytes) -> None:
        """Append raw 16‑bit PCM samples to the server buffer."""
        if not pcm_bytes:
            return
        await self._send({
            "type": "input_audio_buffer.append",
            "audio": _b64encode(pcm_bytes),
        })

    async def commit(self) -> None:
        """Flush the buffer so server‑side VAD can process the utterance."""
        await self._send({"type": "input_audio_buffer.commit"})

    async def events(self) -> AsyncGenerator[Dict, None]:
        """Iterate over OpenAI events as they arrive."""
        while True:
            ev = await self._ev_q.get()
            yield ev

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    async def _send(self, payload: Dict) -> None:
        if not self._ws:
            raise RuntimeError("RealtimeClient not connected")
        await self._ws.send(json.dumps(payload))

    async def _reader(self) -> None:
        try:
            async for msg in self._ws:
                try:
                    ev = json.loads(msg)
                except json.JSONDecodeError:
                    continue  # skip garbage
                await self._ev_q.put(ev)
        except (ConnectionClosedOK, ConnectionClosedError):
            pass
