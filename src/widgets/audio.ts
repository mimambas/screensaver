// Audio helper extracted so it can live outside the React tree.
// Lazy-init AudioContext (browser autoplay policy: must follow user interaction).

let _audioCtx: AudioContext | null = null;
let _audioUnlocked = false;

export function unlockAudio(): void {
  if (_audioUnlocked) return;
  try {
    if (!_audioCtx) {
      const Ctor = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      _audioCtx = new Ctor();
    }
    if (_audioCtx.state === 'suspended') void _audioCtx.resume();
    _audioUnlocked = true;
  } catch {
    _audioUnlocked = false;
  }
}

// --------------------------------------------------------------------------
// Realistic Solari split-flap "clack" — three layers mixed in real time:
//   1. Body thump (low-mid 200Hz triangle, 30ms) — the flap mass hitting
//      its resting position. Gives the sound its weight.
//   2. Noise burst (filtered white noise 1.5kHz HP, 25ms) — the mechanical
//      paper/card edge of the flap brushing through the air as it falls.
//      This is what makes it sound "flappy" rather than electronic.
//   3. Metallic ring (bandpass noise 2.5kHz, 120ms decay) — the post-impact
//      resonance of the metal/aluminium frame, ringing out after the hit.
// Slight per-call randomisation on the body pitch and ring frequency
// makes consecutive flips feel organic rather than identical.
// --------------------------------------------------------------------------

export function playClack(): void {
  if (!_audioUnlocked || !_audioCtx) return;
  try {
    const ctx = _audioCtx;
    const t = ctx.currentTime;
    // Slight per-call variance so back-to-back flips don't sound robotic.
    const bodyFreq = 180 + Math.random() * 60; // 180-240Hz
    const ringFreq = 2200 + Math.random() * 800; // 2.2-3.0kHz
    const master = 0.28;

    // --- Layer 1: body thump (triangle, low-mid, very short) ---
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(bodyFreq * 1.8, t); // pitch drop on impact
    body.frequency.exponentialRampToValueAtTime(bodyFreq, t + 0.03);
    bodyGain.gain.setValueAtTime(0, t);
    bodyGain.gain.linearRampToValueAtTime(master * 0.9, t + 0.002);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    body.connect(bodyGain).connect(ctx.destination);
    body.start(t);
    body.stop(t + 0.08);

    // --- Layer 2: noise burst (filtered white noise) ---
    // Buffer of 0.1s of pre-generated white noise; we slice into it for
    // each clack so we don't allocate per-call.
    const noiseBuf = getNoiseBuffer(ctx, 0.1);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    hp.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(master * 0.6, t + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    noise.connect(hp).connect(noiseGain).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.06);

    // --- Layer 3: metallic ring (bandpass noise, longer decay) ---
    const ringNoise = ctx.createBufferSource();
    ringNoise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = ringFreq;
    bp.Q.value = 6; // narrow band = ringing tone
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0, t);
    ringGain.gain.linearRampToValueAtTime(master * 0.35, t + 0.004);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    ringNoise.connect(bp).connect(ringGain).connect(ctx.destination);
    ringNoise.start(t);
    ringNoise.stop(t + 0.16);
  } catch {
    // audio not available — silent fallback
  }
}

// Cache a single noise buffer; reuse across clacks.
let _noiseBuf: AudioBuffer | null = null;
function getNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  if (_noiseBuf && _noiseBuf.sampleRate === ctx.sampleRate) return _noiseBuf;
  const len = Math.floor(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  _noiseBuf = buf;
  return buf;
}

export function playChime(): void {
  try {
    const Ctor = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const t = ctx.currentTime;
    // Two-tone bell: ding-dong
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, t + i * 0.4);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.4 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.4 + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.4);
      osc.stop(t + i * 0.4 + 0.4);
    });
  } catch {
    // ignore — audio not available
  }
}
