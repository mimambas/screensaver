// Audio mix bus — singleton gain graph that everything routes
// through. Three stages, each with its own gain node + mute:
//
//   destination
//     ↑ master (always last)
//       ↑ chime (playChimePreset / playClack / casio bip)
//       ↑ ambient (soundscape engine output)
//       ↑ notif (in-page notification "ding" if any)
//
// Why a bus? Three reasons:
//   1. Per-stage mutes (turn off the chimes without stopping the
//      rain) — a single gain node makes this trivial.
//   2. A single AudioContext shared across all consumers means
//      browsers don't run into the "too many contexts" warning
//      and tabs share the autoplay-unlock state.
//   3. Volume changes don't require re-creating the audio graph;
//      we just .value = newVolume on a GainNode. O(1) work.
//
// Volume convention: each stage accepts 0..1 (linear). The
// product (master × chime, etc.) is the actual amplitude reaching
// the destination. We don't apply any perceptual curve — the
// settings panel labels make it clear that 0.5 is "half loudness"
// rather than "half dB".

import { useEffect, useState, useCallback } from 'react';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export type Stage = 'master' | 'chime' | 'ambient' | 'notif';

class AudioMixer {
  private ctx: AudioContext | null = null;
  private gains: Record<Stage, GainNode | null> = {
    master: null,
    chime: null,
    ambient: null,
    notif: null,
  };
  /** Per-stage volume 0..1. */
  private volumes: Record<Stage, number> = {
    master: 1.0,
    chime: 0.7,
    ambient: 0.5,
    notif: 0.8,
  };
  /** Per-stage mute. Multiplies the volume to 0. */
  private muted: Record<Stage, boolean> = {
    master: false,
    chime: false,
    ambient: false,
    notif: false,
  };

  /** Ensure the audio graph exists. Idempotent. */
  ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      // Wire the bus:
      //   destination ← master ← chime
      //                        ← ambient
      //                        ← notif
      const ctx = this.ctx;
      const master = ctx.createGain();
      const chime = ctx.createGain();
      const ambient = ctx.createGain();
      const notif = ctx.createGain();
      master.gain.value = this.effectiveGain('master');
      chime.gain.value = this.effectiveGain('chime');
      ambient.gain.value = this.effectiveGain('ambient');
      notif.gain.value = this.effectiveGain('notif');
      chime.connect(master);
      ambient.connect(master);
      notif.connect(master);
      master.connect(ctx.destination);
      this.gains.master = master;
      this.gains.chime = chime;
      this.gains.ambient = ambient;
      this.gains.notif = notif;
      return ctx;
    } catch {
      return null;
    }
  }

  /** Get the input node for a stage. WebAudio callers connect
   *  their sources here so they can be mixed and routed. */
  input(stage: Stage): AudioNode | null {
    if (!this.ctx) this.ensureContext();
    return this.gains[stage];
  }

  /** Direct AudioContext access (for buffer creation etc). */
  context(): AudioContext | null {
    return this.ctx;
  }

  setVolume(stage: Stage, v: number) {
    this.volumes[stage] = clamp01(v);
    this.applyGain(stage);
  }

  setMuted(stage: Stage, m: boolean) {
    this.muted[stage] = m;
    this.applyGain(stage);
  }

  getVolume(stage: Stage): number {
    return this.volumes[stage];
  }

  getMuted(stage: Stage): boolean {
    return this.muted[stage];
  }

  private effectiveGain(stage: Stage): number {
    return this.muted[stage] ? 0 : this.volumes[stage];
  }

  private applyGain(stage: Stage) {
    const node = this.gains[stage];
    if (!node) return;
    // Smooth ramp avoids pops on rapid slider changes.
    try {
      const ctx = this.ctx!;
      const t = ctx.currentTime;
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(this.effectiveGain(stage), t, 0.01);
    } catch {
      node.gain.value = this.effectiveGain(stage);
    }
  }
}

let _mixer: AudioMixer | null = null;
function getMixer(): AudioMixer {
  if (!_mixer) _mixer = new AudioMixer();
  return _mixer;
}

/** Programmatic access for engine code (Ambient, chimes, etc). */
export const mixer = {
  ensureContext: () => getMixer().ensureContext(),
  context: () => getMixer().context(),
  input: (stage: Stage) => getMixer().input(stage),
  setVolume: (stage: Stage, v: number) => getMixer().setVolume(stage, v),
  setMuted: (stage: Stage, m: boolean) => getMixer().setMuted(stage, m),
  getVolume: (stage: Stage) => getMixer().getVolume(stage),
  getMuted: (stage: Stage) => getMixer().getMuted(stage),
};

/** Test-only: reset the singleton so each test gets a fresh bus. */
export function __resetMixerForTests(): void {
  _mixer = null;
}

// --------------------------------------------------------------------------
// React hook for the settings panel — reads current volumes + mutes
// and exposes setters that call through to the mixer.
// --------------------------------------------------------------------------

export interface MixerState {
  master: number;
  chime: number;
  ambient: number;
  notif: number;
  muted: { master: boolean; chime: boolean; ambient: boolean; notif: boolean };
}

export function useAudioMixer(): {
  state: MixerState;
  setVolume: (stage: Stage, v: number) => void;
  setMuted: (stage: Stage, m: boolean) => void;
} {
  const m = getMixer();
  // Local React state mirrors the mixer's values so the settings
  // panel can render sliders. We sync on mount + after every
  // setter call (which is rare — only when the user touches a
  // slider).
  const [state, setState] = useState<MixerState>(() => ({
    master: m.getVolume('master'),
    chime: m.getVolume('chime'),
    ambient: m.getVolume('ambient'),
    notif: m.getVolume('notif'),
    muted: {
      master: m.getMuted('master'),
      chime: m.getMuted('chime'),
      ambient: m.getMuted('ambient'),
      notif: m.getMuted('notif'),
    },
  }));

  // Re-sync if some other code path mutates the mixer (the
  // ambient engine does, on volume changes from the picker).
  // We poll at 250ms while the settings panel is mounted.
  useEffect(() => {
    const id = window.setInterval(() => {
      setState({
        master: m.getVolume('master'),
        chime: m.getVolume('chime'),
        ambient: m.getVolume('ambient'),
        notif: m.getVolume('notif'),
        muted: {
          master: m.getMuted('master'),
          chime: m.getMuted('chime'),
          ambient: m.getMuted('ambient'),
          notif: m.getMuted('notif'),
        },
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [m]);

  const setVolume = useCallback((stage: Stage, v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    m.setVolume(stage, clamped);
    setState((s) => ({ ...s, [stage]: clamped } as MixerState));
  }, [m]);

  const setMuted = useCallback((stage: Stage, muted: boolean) => {
    m.setMuted(stage, muted);
    setState((s) => ({ ...s, muted: { ...s.muted, [stage]: muted } }));
  }, [m]);

  return { state, setVolume, setMuted };
}

// --------------------------------------------------------------------------
// Backward-compat: the original `unlockAudio` / `_audioUnlocked`
// was used by other modules to ensure the context was running
// before playing sounds. We keep the same name + behavior; it
// now goes through the mixer.
// --------------------------------------------------------------------------

let _audioUnlocked = false;
export function unlockAudio(): void {
  if (_audioUnlocked) return;
  const ctx = mixer.ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  _audioUnlocked = true;
}
export function isAudioUnlocked(): boolean {
  return _audioUnlocked;
}

// --------------------------------------------------------------------------
// Chime presets — each connects to the mixer's `chime` input
// instead of `ctx.destination` directly. This means a single
// `mixer.setVolume('chime', 0)` mutes all chimes simultaneously.
// --------------------------------------------------------------------------

export type ChimeId = 'bell' | 'ding' | 'gong' | 'wood' | 'digital' | 'mute';

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

function bell(): void {
  const ctx = mixer.context();
  const inNode = mixer.input('chime');
  if (!ctx || !inNode) return;
  const t = ctx.currentTime;
  [880, 660].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = gainEnv(ctx, t + i * 0.4, 0.01, 0.35, 0.25);
    osc.frequency.value = freq;
    osc.type = 'sine';
    osc.connect(g).connect(inNode);
    osc.start(t + i * 0.4);
    osc.stop(t + i * 0.4 + 0.4);
  });
}

function ding(): void {
  const ctx = mixer.context();
  const inNode = mixer.input('chime');
  if (!ctx || !inNode) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gainEnv(ctx, t, 0.005, 0.5, 0.2);
  osc.frequency.setValueAtTime(1320, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.4);
  osc.type = 'sine';
  osc.connect(g).connect(inNode);
  osc.start(t);
  osc.stop(t + 0.55);
}

function gong(): void {
  const ctx = mixer.context();
  const inNode = mixer.input('chime');
  if (!ctx || !inNode) return;
  const t = ctx.currentTime;
  [180, 270].forEach((freq) => {
    const osc = ctx.createOscillator();
    const g = gainEnv(ctx, t, 0.02, 1.6, 0.18);
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + 1.5);
    osc.type = 'sine';
    osc.connect(g).connect(inNode);
    osc.start(t);
    osc.stop(t + 1.7);
  });
}

function wood(): void {
  const ctx = mixer.context();
  const inNode = mixer.input('chime');
  if (!ctx || !inNode) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = gainEnv(ctx, t, 0.002, 0.06, 0.3);
  osc.frequency.setValueAtTime(900, t);
  osc.frequency.exponentialRampToValueAtTime(380, t + 0.04);
  osc.type = 'triangle';
  osc.connect(g).connect(inNode);
  osc.start(t);
  osc.stop(t + 0.08);
}

function digital(): void {
  const ctx = mixer.context();
  const inNode = mixer.input('chime');
  if (!ctx || !inNode) return;
  const t = ctx.currentTime;
  [1000, 800].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = gainEnv(ctx, t + i * 0.18, 0.002, 0.12, 0.18);
    osc.frequency.value = freq;
    osc.type = 'square';
    osc.connect(g).connect(inNode);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.15);
  });
}

const CHIMES: Record<ChimeId, () => void> = {
  bell,
  ding,
  gong,
  wood,
  digital,
  mute: () => {},
};

export function playChimePreset(chime: ChimeId): void {
  const fn = CHIMES[chime] ?? bell;
  fn();
}

/** Back-compat: the original bell chime. */
export function playChime(): void {
  bell();
}

// --------------------------------------------------------------------------
// Realistic Solari split-flap "clack" — three layers mixed in
// real time, now also routed through the chime stage.
// --------------------------------------------------------------------------

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

export function playClack(): void {
  const ctx = mixer.context();
  const inNode = mixer.input('chime');
  if (!ctx || !inNode) return;
  try {
    const t = ctx.currentTime;
    const bodyFreq = 180 + Math.random() * 60;
    const ringFreq = 2200 + Math.random() * 800;
    const master = 0.28;

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(bodyFreq * 1.8, t);
    body.frequency.exponentialRampToValueAtTime(bodyFreq, t + 0.03);
    bodyGain.gain.setValueAtTime(0, t);
    bodyGain.gain.linearRampToValueAtTime(master * 0.9, t + 0.002);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    body.connect(bodyGain).connect(inNode);
    body.start(t);
    body.stop(t + 0.08);

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
    noise.connect(hp).connect(noiseGain).connect(inNode);
    noise.start(t);
    noise.stop(t + 0.06);

    const ringNoise = ctx.createBufferSource();
    ringNoise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = ringFreq;
    bp.Q.value = 6;
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0, t);
    ringGain.gain.linearRampToValueAtTime(master * 0.35, t + 0.004);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    ringNoise.connect(bp).connect(ringGain).connect(inNode);
    ringNoise.start(t);
    ringNoise.stop(t + 0.16);
  } catch {
    // audio not available — silent fallback
  }
}
