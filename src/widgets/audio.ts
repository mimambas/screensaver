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

// --------------------------------------------------------------------------
// Chime presets — distinct timbres for Pomodoro phase ends + alarm fire.
// All are pure WebAudio (no asset files) so the bundle stays small and
// they work offline. Each preset returns a function that schedules the
// sound on the shared audio context; we bail silently if audio is
// suspended or unavailable.
//
//   bell     — two-tone western doorbell (the original chime)
//   ding     — single soft high note, gentle phase end
//   gong     — low mallet strike with long decay
//   wood     — short wooden block (knock)
//   digital  — short 8-bit-style square wave beep
// --------------------------------------------------------------------------

export type ChimeId = 'bell' | 'ding' | 'gong' | 'wood' | 'digital' | 'mute';

function ensureCtx(): AudioContext | null {
  // Try the unlocked context first; fall back to a one-shot ctx
  // (browsers allow audio inside a user-gesture handler, so callers
  // from the React event path can pass through). If neither works,
  // we silently bail.
  if (_audioCtx) return _audioCtx;
  try {
    const Ctor = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
    if (_audioCtx.state === 'suspended') void _audioCtx.resume();
    return _audioCtx;
  } catch {
    return null;
  }
}

function gainEnv(
  ctx: AudioContext,
  t: number,
  attack: number,
  release: number,
  peak: number,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + release);
  return g;
}

// Bell — two-tone descending (original chime).
function playBell(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  [880, 660].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = gainEnv(ctx, t + i * 0.4, 0.01, 0.35, 0.25);
    osc.frequency.value = freq;
    osc.type = 'sine';
    osc.connect(g).connect(ctx.destination);
    osc.start(t + i * 0.4);
    osc.stop(t + i * 0.4 + 0.4);
  });
}

// Ding — single high note, short and bright.
function playDing(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gainEnv(ctx, t, 0.005, 0.5, 0.2);
  osc.frequency.setValueAtTime(1320, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.4);
  osc.type = 'sine';
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.55);
}

// Gong — low strike with long exponential decay.
function playGong(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Fundamental + 5th (a classic gong has rich partials).
  [180, 270].forEach((freq) => {
    const osc = ctx.createOscillator();
    const g = gainEnv(ctx, t, 0.02, 1.6, 0.18);
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + 1.5);
    osc.type = 'sine';
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.7);
  });
}

// Wood — short wooden block (knock).
function playWood(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gainEnv(ctx, t, 0.002, 0.06, 0.3);
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(380, t + 0.04);
  osc.type = 'triangle';
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

// Digital — 8-bit-style square beep.
function playDigital(): void {
  const ctx = ensureCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Two short beeps, classic alarm feel.
  [1000, 800].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = gainEnv(ctx, t + i * 0.18, 0.002, 0.12, 0.18);
    osc.frequency.value = freq;
    osc.type = 'square';
    osc.connect(g).connect(ctx.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.15);
  });
}

const CHIMES: Record<ChimeId, () => void> = {
  bell: playBell,
  ding: playDing,
  gong: playGong,
  wood: playWood,
  digital: playDigital,
  mute: () => {},
};

/**
 * Play the named chime. `chime === 'mute'` is a no-op. Falls back
 * to `bell` if the id is unknown.
 */
export function playChimePreset(chime: ChimeId): void {
  const fn = CHIMES[chime] ?? playBell;
  fn();
}

/** Back-compat: the original bell chime (preserves existing call sites). */
export function playChime(): void {
  playBell();
}
