// static/js/audio/input-pcm-processor.js
// AudioWorkletProcessor that converts Float32 input frames (-1..1) into
// a transferable ArrayBuffer containing 16‑bit little‑endian PCM samples.
// Each `process()` call typically handles 128 frames (~5.3 ms at 24 kHz),
// which keeps latency low enough for the Realtime API.
//
// The main thread attaches a message handler to `port.onmessage` to receive
// the ArrayBuffer and forward it (e.g. via Socket.IO) to the backend.
// ---------------------------------------------------------------------------
/* eslint-disable no-undef */
class InputPCMProcessor extends AudioWorkletProcessor {
  process (inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true // no data yet

    const float32 = input[0] // Float32Array of [-1..1]
    const pcm = new Int16Array(float32.length)

    // Convert float [-1,1] → int16
    for (let i = 0; i < float32.length; i++) {
      let s = float32[i] * 0x7fff
      // clamp just in case
      if (s > 0x7fff) s = 0x7fff
      else if (s < -0x8000) s = -0x8000
      pcm[i] = s
    }

    // Transfer the underlying buffer to main thread (zero‑copy)
    this.port.postMessage(pcm.buffer, [pcm.buffer])
    return true // keep processor alive
  }
}

registerProcessor('input-pcm', InputPCMProcessor)
