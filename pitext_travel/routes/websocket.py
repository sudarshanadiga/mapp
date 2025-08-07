# ── imports ────────────────────────────────────────────────────────────────
import asyncio, logging, base64
from flask import current_app
from flask_socketio import Namespace, emit
from ..api.realtime.openai_client import RealtimeClient

log = logging.getLogger(__name__)

# ── namespace ──────────────────────────────────────────────────────────────
class TravelVoiceNS(Namespace):
    """
    Socket.IO ↔ OpenAI-Realtime bridge
    Path: /travel/voice
    """
    def __init__(self, namespace):
        super().__init__(namespace)
        self.rt = None     # RealtimeClient

    # -------- connects / disconnects --------------------------------------
    def on_connect(self):
        api_key = current_app.config['OPENAI_API_KEY']
        self.rt = RealtimeClient(api_key)
        asyncio.create_task(self.rt.connect())
        asyncio.create_task(self._fanout())
        log.info('Voice WS connected')

    def on_disconnect(self):
        if self.rt:
            asyncio.create_task(self.rt.close())
        log.info('Voice WS disconnected')

    # -------- browser → backend ------------------------------------------
    def on_audio_chunk(self, data):
        # data['pcm'] is an ArrayBuffer -> bytes on JS side
        asyncio.create_task(self.rt.push_pcm(data['pcm']))

    def on_audio_commit(self):
        asyncio.create_task(self.rt.push_pcm(b'', commit=True))

    # -------- backend → browser ------------------------------------------
    async def _fanout(self):
        async for ev in self.rt.events():
            t = ev.get('type', '')
            if t == 'conversation.item.created':
                emit('assistant_text', {'text': ev['item']['message']})
            elif t == 'output_audio_buffer.payload':
                emit('assistant_audio', {'audio': ev['audio']})
            # add other event types if you later use tools / function-calling
