// static/js/voice.js
// ---------------------------------------------------------------------------
// Web‑Audio voice controller for OpenAI Realtime
// ---------------------------------------------------------------------------
// Responsibilities
//   • Capture microphone at 24 kHz mono PCM using an AudioWorklet
//   • Stream raw PCM chunks to the backend through Socket.IO
//   • Send a commit signal when the user stops speaking (mic toggle)
//   • Receive base‑64 PCM from the backend (`assistant_audio`) and play it
//   • Expose a global `window.voice` object so existing UI code can call
//       voice.start(), voice.stop(), voice.toggle(), etc.
//
// Assumptions
//   • The backend Socket.IO namespace is `/travel/voice` (see websocket.py)
//   • `socket.io.js` (or ESM) is already loaded on the page and exposes `io`
//   • `input-pcm-processor.js` (AudioWorklet) is served at
//         /static/js/audio/input-pcm-processor.js
//   • A mic button exists with id `#mic-btn`
// ---------------------------------------------------------------------------
/* global io */

(function () {
  class VoiceController {
    constructor (buttonSelector = '#mic-btn') {
      // ---------------------------------------------------------------------
      // 1  UI: mic button ----------------------------------------------------
      // ---------------------------------------------------------------------
      this.button = document.querySelector(buttonSelector)
      if (!this.button) {
        console.warn('Mic button not found – voice disabled')
        return
      }
      this.button.addEventListener('click', () => this.toggle())

      // ---------------------------------------------------------------------
      // 2  Socket.IO connection to backend ----------------------------------
      // ---------------------------------------------------------------------
      this.socket = io('/travel/voice')

      // Playback handler (assistant → audio chunks)
      this.socket.on('assistant_audio', ({ audio }) => this._playAssistant(b64ToPCM(audio)))

      // Optional: assistant text (hook for chat bubble ‑ only if you want it)
      this.socket.on('assistant_text', ({ text }) => {
        if (window.TravelChat) window.TravelChat.addAssistantMessage(text)
      })

      // ---------------------------------------------------------------------
      // 3  Audio context / worklet ------------------------------------------
      // ---------------------------------------------------------------------
      this.audioCtx = null         // lazy‑init after first click
      this.worklet = null
      this.isRecording = false
    }

    // ---------------------------------------------------------------------
    // Public API (used by other JS modules if needed) ----------------------
    // ---------------------------------------------------------------------
    async start () {
      if (this.isRecording) return

      await this._ensureAudioPipeline()
      await this.audioCtx.resume()       // required after a user gesture
      this.button.classList.add('active')
      this.isRecording = true
    }

    stop () {
      if (!this.isRecording) return
      this.button.classList.remove('active')
      this.isRecording = false
      // Tell backend to commit what we just said so server‑side VAD can act
      this.socket.emit('audio_commit')
    }

    toggle () {
      this.isRecording ? this.stop() : this.start()
    }

    // ---------------------------------------------------------------------
    // Private helpers ------------------------------------------------------
    // ---------------------------------------------------------------------
    async _ensureAudioPipeline () {
      if (this.audioCtx) return

      // Create AudioContext matching OpenAI 24 kHz sample rate
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      })

      // Load the AudioWorklet that converts float‑32 to 16‑bit PCM LE
      try {
        await this.audioCtx.audioWorklet.addModule('/static/js/audio/input-pcm-processor.js')
      } catch (err) {
        console.error('Failed to load AudioWorklet:', err)
        return
      }

      // Open microphone stream (prompts the user the first time)
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const src = this.audioCtx.createMediaStreamSource(this.stream)

      // Worklet node that receives Float32 chunks and sends ArrayBuffer via port
      this.worklet = new AudioWorkletNode(this.audioCtx, 'input-pcm')

      // Forward PCM to backend in small chunks (~128 frames = ~5 ms)
      this.worklet.port.onmessage = ({ data }) => {
        this.socket.emit('audio_chunk', { pcm: data })
      }

      // Mic → worklet (no need to monitor output)
      src.connect(this.worklet)
    }

    _playAssistant ({ float32, sampleRate = 24000 }) {
      // Ensure AudioContext exists (might be closed if user never spoke yet)
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate
        })
      }

      const buf = this.audioCtx.createBuffer(1, float32.length, sampleRate)
      buf.copyToChannel(float32, 0)
      const src = this.audioCtx.createBufferSource()
      src.buffer = buf
      src.connect(this.audioCtx.destination)
      src.start()
    }
  }

  // -----------------------------------------------------------------------
  // Helper: base‑64 → Float32Array (normalised −1 … +1) -------------------
  // -----------------------------------------------------------------------
  function b64ToPCM (b64) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const int16 = new Int16Array(bytes.buffer)
    const float32 = Float32Array.from(int16, s => s / 0x7fff)
    return { float32, sampleRate: 24000 }
  }

  // Attach globally so other scripts can call voice.toggle(), etc.
  window.voice = new VoiceController()
})()
