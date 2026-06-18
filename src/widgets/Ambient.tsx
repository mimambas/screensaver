// WebAudio synth-based ambient sound. We don't ship any audio
// files — every soundscape is generated procedurally with noise
// generators, biquad filters, LFOs, and scheduled micro-events.
//
// Each soundscape is a `Soundscape` object: a `start(ctx)` builder
// that wires up the node graph and returns a `stop()` for teardown.
// A new style only needs (a) a noise buffer, (b) a filter chain,
// (c) optional event schedulers (chirps, pops, swells). The
// AmbientEngine handles gain/volume/lifecycle.
//
// Why procedural? Zero network, zero decode latency, zero bandwidth,
// infinite variation. CPU cost is ~1% on modern devices even with
// 5+ concurrent voices.

import { useEffect, useRef } from 'react';
import { mixer } from './audio';

export type AmbientStyle =
  | 'rain'
  | 'forest'
  | 'white'
  | 'fireplace'
  | 'ocean'
  | 'stream'
  | 'wind'
  | 'night'
  | 'cafe';

// ── Noise buffer builders ──────────────────────────────────────────
// White noise: uniform random.
// Pink noise:  1/f spectrum (Voss-McCartney algorithm, fast).
// Brown noise: integrated white noise (random walk).
function makeNoiseBuffer(
  ctx: AudioContext,
  durationSec: number,
  kind: 'white' | 'pink' | 'brown',
): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    // Pink — Paul Kellet's economy filter.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

// ── Soundscape interface ──────────────────────────────────────────
// A `Soundscape` builds a subgraph rooted at `out` and returns a
// `teardown()` that disconnects everything and clears timers. The
// engine owns the master gain + AudioContext; each style owns its
// own filter chain, LFOs, and scheduled events.
interface Soundscape {
  out: AudioNode;
  teardown: () => void;
}

type ScapeBuilder = (ctx: AudioContext) => Soundscape;

// ── RAIN ──────────────────────────────────────────────────────────
// Filtered white noise bandpassed at 1.5kHz — the classic "hiss"
// that reads as rainfall. No scheduled events; the noise IS the
// texture.
const buildRain: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'white');
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 0.5;
  src.connect(bp);
  return { out: bp, teardown: () => { src.disconnect(); bp.disconnect(); } };
};

// ── FOREST ────────────────────────────────────────────────────────
// Brown noise (low-passed wind-through-trees) + occasional bird
// chirps (sine sweep 2-3kHz, 80-150ms). The wind is constant;
// the birds are scheduled events.
const buildForest: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'brown');
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  src.connect(lp);

  // Chirp scheduler — 4-12s between events.
  let timer: number | null = null;
  const gain = ctx.createGain();
  gain.gain.value = 0.7;
  lp.connect(gain);

  const scheduleChirp = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.08 + Math.random() * 0.07;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000 + Math.random() * 800, now);
    osc.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 600, now + dur);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(gain);
    osc.start(now);
    osc.stop(now + dur + 0.01);
    timer = window.setTimeout(scheduleChirp, 4000 + Math.random() * 8000);
  };
  timer = window.setTimeout(scheduleChirp, 2000 + Math.random() * 3000);

  return {
    out: gain,
    teardown: () => {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      src.disconnect();
      lp.disconnect();
      gain.disconnect();
    },
  };
};

// ── WHITE (flat reference noise) ──────────────────────────────────
const buildWhite: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'white');
  src.loop = true;
  return { out: src, teardown: () => { src.disconnect(); } };
};

// ── FIREPLACE ─────────────────────────────────────────────────────
// Brown noise low-passed at 400Hz = low rumble of burning wood.
// Random "pops" — short bursts of high-freq noise, simulating
// crackling logs. The pops dominate the character; the rumble is
// the bed.
const buildFireplace: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'brown');
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.7;
  src.connect(lp).connect(bedGain);

  let timer: number | null = null;
  const sum = ctx.createGain();
  sum.gain.value = 1.0;
  bedGain.connect(sum);

  const schedulePop = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.02 + Math.random() * 0.04;
    // Short burst of high-passed white noise — a crackle.
    const popSrc = ctx.createBufferSource();
    popSrc.buffer = makeNoiseBuffer(ctx, 0.1, 'white');
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.3 + Math.random() * 0.3, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    popSrc.connect(hp).connect(g).connect(sum);
    popSrc.start(now);
    popSrc.stop(now + dur + 0.01);
    // Fire pops are frequent but irregular: 0.15-0.8s between them.
    timer = window.setTimeout(schedulePop, 150 + Math.random() * 650);
  };
  timer = window.setTimeout(schedulePop, 500);

  return {
    out: sum,
    teardown: () => {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      src.disconnect();
      lp.disconnect();
      bedGain.disconnect();
      sum.disconnect();
    },
  };
};

// ── OCEAN ─────────────────────────────────────────────────────────
// Waves: white noise bandpassed 600Hz, gain modulated by a 0.1Hz LFO
// (10s swell period). Plus periodic "foam" — brief high-frequency
// bursts when a wave breaks. The LFO creates the swash rhythm; the
// foam adds detail.
const buildOcean: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'white');
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600;
  bp.Q.value = 0.5;
  src.connect(bp);

  // LFO modulates the swell gain between 0.2 and 1.0 over 10s.
  const swell = ctx.createGain();
  swell.gain.value = 0.5;
  bp.connect(swell);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.1; // 10s period
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.3; // depth: gain swings 0.2 → 0.8
  lfo.connect(lfoGain).connect(swell.gain);
  lfo.start();

  // Foam bursts — high-frequency noise, scheduled at random phase
  // of the swell cycle.
  let timer: number | null = null;
  const sum = ctx.createGain();
  swell.connect(sum);

  const scheduleFoam = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.5 + Math.random() * 1.0;
    const foamSrc = ctx.createBufferSource();
    foamSrc.buffer = makeNoiseBuffer(ctx, 0.1, 'white');
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    foamSrc.connect(hp).connect(g).connect(sum);
    foamSrc.start(now);
    foamSrc.stop(now + dur + 0.01);
    // Foam hits the trough of the swell (when gain is highest).
    timer = window.setTimeout(scheduleFoam, 2000 + Math.random() * 4000);
  };
  timer = window.setTimeout(scheduleFoam, 3000);

  return {
    out: sum,
    teardown: () => {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      lfo.stop();
      src.disconnect();
      bp.disconnect();
      swell.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
      sum.disconnect();
    },
  };
};

// ── STREAM ────────────────────────────────────────────────────────
// Brown noise high-passed at 800Hz (water trickle over rocks) +
// random bubble pops (sine sweep 200-400Hz, 50-200ms).
const buildStream: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'brown');
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 800;
  const trickle = ctx.createGain();
  trickle.gain.value = 0.6;
  src.connect(hp).connect(trickle);

  let timer: number | null = null;
  const sum = ctx.createGain();
  sum.gain.value = 1.0;
  trickle.connect(sum);

  const scheduleBubble = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.05 + Math.random() * 0.15;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(400 + Math.random() * 200, now + dur);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.15 + Math.random() * 0.1, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(sum);
    osc.start(now);
    osc.stop(now + dur + 0.01);
    // Bubbles: 0.5-2s between them.
    timer = window.setTimeout(scheduleBubble, 500 + Math.random() * 1500);
  };
  timer = window.setTimeout(scheduleBubble, 1000);

  return {
    out: sum,
    teardown: () => {
      if (timer !== null) { window.clearTimeout(timer); timer = null; }
      src.disconnect();
      hp.disconnect();
      trickle.disconnect();
      sum.disconnect();
    },
  };
};

// ── WIND ──────────────────────────────────────────────────────────
// White noise with a sweeping bandpass — 200-1200Hz over 8s, then
// reverse. LFO controls the bandpass frequency, so the wind sounds
// like it's gusting past you. The gain also swells gently to make
// some gusts louder than others.
const buildWind: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'white');
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700;
  bp.Q.value = 1.2;
  src.connect(bp);

  const sum = ctx.createGain();
  sum.gain.value = 0.7;
  bp.connect(sum);

  // LFO sweeps the bandpass center frequency.
  const lfo = ctx.createOscillator();
  lfo.type = 'triangle';
  lfo.frequency.value = 0.125; // 8s period
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 500; // ±500Hz around 700Hz center
  lfo.connect(lfoGain).connect(bp.frequency);
  lfo.start();

  // Secondary LFO modulates the gain for "gusts" — slower (0.05Hz
  // = 20s) but with bigger depth.
  const gainLfo = ctx.createOscillator();
  gainLfo.type = 'sine';
  gainLfo.frequency.value = 0.05;
  const gainLfoAmp = ctx.createGain();
  gainLfoAmp.gain.value = 0.25;
  gainLfo.connect(gainLfoAmp).connect(sum.gain);
  gainLfo.start();

  return {
    out: sum,
    teardown: () => {
      lfo.stop();
      gainLfo.stop();
      src.disconnect();
      bp.disconnect();
      sum.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
      gainLfo.disconnect();
      gainLfoAmp.disconnect();
    },
  };
};

// ── NIGHT ─────────────────────────────────────────────────────────
// Pink noise (1/f — sounds like distant rustling) + cricket chirps
// (3-4 short sine bursts at 3-5kHz, 30-50ms each, repeated 3-4x in
// quick succession) + occasional low owl hoot (180Hz sine, 600ms
// with slow decay). Crickets are frequent; owls are rare.
const buildNight: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'pink');
  src.loop = true;
  const bed = ctx.createGain();
  bed.gain.value = 0.5;
  src.connect(bed);

  const sum = ctx.createGain();
  sum.gain.value = 1.0;
  bed.connect(sum);

  let cricketTimer: number | null = null;
  let owlTimer: number | null = null;

  const playCricket = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    // 3-5 short pulses, each 30-50ms, 60-100ms apart.
    const pulses = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) {
      const t = now + i * (0.06 + Math.random() * 0.04);
      const dur = 0.03 + Math.random() * 0.02;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 3000 + Math.random() * 2000;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(sum);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    }
    // Crickets: 1.5-4s between bursts.
    cricketTimer = window.setTimeout(playCricket, 1500 + Math.random() * 2500);
  };

  const playOwl = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.6;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + dur);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(sum);
    osc.start(now);
    osc.stop(now + dur + 0.01);
    // Owls: 15-30s between hoots.
    owlTimer = window.setTimeout(playOwl, 15000 + Math.random() * 15000);
  };

  cricketTimer = window.setTimeout(playCricket, 1000);
  owlTimer = window.setTimeout(playOwl, 8000 + Math.random() * 7000);

  return {
    out: sum,
    teardown: () => {
      if (cricketTimer !== null) { window.clearTimeout(cricketTimer); cricketTimer = null; }
      if (owlTimer !== null) { window.clearTimeout(owlTimer); owlTimer = null; }
      src.disconnect();
      bed.disconnect();
      sum.disconnect();
    },
  };
};

// ── CAFE ──────────────────────────────────────────────────────────
// White noise bandpassed 1kHz (room tone / murmur bed) + occasional
// cup clinks (sine 1.5kHz with very fast decay) + occasional chair
// scrapes (noise burst with bandpass sweep 800-200Hz over 300ms).
// Clinks are common, scrapes are rare.
const buildCafe: ScapeBuilder = (ctx) => {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 2, 'white');
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1000;
  bp.Q.value = 0.8;
  const murmur = ctx.createGain();
  murmur.gain.value = 0.4;
  src.connect(bp).connect(murmur);

  const sum = ctx.createGain();
  sum.gain.value = 1.0;
  murmur.connect(sum);

  let clinkTimer: number | null = null;
  let scrapeTimer: number | null = null;

  const playClink = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.15;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + dur);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(sum);
    osc.start(now);
    osc.stop(now + dur + 0.01);
    // Clinks: 2-6s apart.
    clinkTimer = window.setTimeout(playClink, 2000 + Math.random() * 4000);
  };

  const playScrape = () => {
    if (ctx.state === 'closed') return;
    const now = ctx.currentTime;
    const dur = 0.3;
    const scrapeSrc = ctx.createBufferSource();
    scrapeSrc.buffer = makeNoiseBuffer(ctx, 0.1, 'white');
    const sbp = ctx.createBiquadFilter();
    sbp.type = 'bandpass';
    sbp.frequency.setValueAtTime(2000, now);
    sbp.frequency.exponentialRampToValueAtTime(400, now + dur);
    sbp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    scrapeSrc.connect(sbp).connect(g).connect(sum);
    scrapeSrc.start(now);
    scrapeSrc.stop(now + dur + 0.01);
    // Scrapes: 20-40s apart.
    scrapeTimer = window.setTimeout(playScrape, 20000 + Math.random() * 20000);
  };

  clinkTimer = window.setTimeout(playClink, 2000);
  scrapeTimer = window.setTimeout(playScrape, 10000 + Math.random() * 10000);

  return {
    out: sum,
    teardown: () => {
      if (clinkTimer !== null) { window.clearTimeout(clinkTimer); clinkTimer = null; }
      if (scrapeTimer !== null) { window.clearTimeout(scrapeTimer); scrapeTimer = null; }
      src.disconnect();
      bp.disconnect();
      murmur.disconnect();
      sum.disconnect();
    },
  };
};

const BUILDERS: Record<AmbientStyle, ScapeBuilder> = {
  rain: buildRain,
  forest: buildForest,
  white: buildWhite,
  fireplace: buildFireplace,
  ocean: buildOcean,
  stream: buildStream,
  wind: buildWind,
  night: buildNight,
  cafe: buildCafe,
};

// ── Engine ────────────────────────────────────────────────────────
// Singleton. Owns the AudioContext, master gain, and the active
// soundscape. Volume changes go straight to the master; style
// changes tear down the old scape and start the new one.
class AmbientEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private scape: Soundscape | null = null;
  private style: AmbientStyle | null = null;

  start(style: AmbientStyle, volume: number) {
    if (this.style === style && this.ctx) {
      if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, volume));
      return;
    }
    this.stop();
    this.style = style;
    // The mixer owns the AudioContext + master gain. We route
    // through the 'ambient' input so the settings panel can mute
    // or re-volume the ambient stage independently.
    const ctx = mixer.ensureContext();
    if (!ctx) return;
    const input = mixer.input('ambient');
    if (!input) return;
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.gain.value = Math.max(0, Math.min(1, volume));
    this.gain.connect(input);

    const builder = BUILDERS[style];
    this.scape = builder(ctx);
    this.scape.out.connect(this.gain);
    if (ctx.state === 'suspended') void ctx.resume();
  }

  setVolume(v: number) {
    if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, v));
  }

  stop() {
    if (this.scape) {
      try { this.scape.teardown(); } catch { /* node already gone */ }
      this.scape = null;
    }
    if (this.gain) {
      try { this.gain.disconnect(); } catch { /* noop */ }
      this.gain = null;
    }
    // We do NOT close the AudioContext — the mixer is a process
    // singleton, and other stages may still be using it. We just
    // null out our local refs so the next start() builds a fresh
    // gain.
    this.ctx = null;
    this.style = null;
  }
}

let _engine: AmbientEngine | null = null;
function getEngine(): AmbientEngine {
  if (!_engine) _engine = new AmbientEngine();
  return _engine;
}

export function useAmbient(style: AmbientStyle | 'none', volume: number) {
  const styleRef = useRef(style);
  const volRef = useRef(volume);
  // Sync refs in an effect rather than during render — assigning to
  // refs directly during render is a React anti-pattern and trips
  // the eslint-plugin-react-hooks rule.
  useEffect(() => {
    styleRef.current = style;
    volRef.current = volume;
  }, [style, volume]);

  useEffect(() => {
    if (style === 'none') {
      getEngine().stop();
      return;
    }
    getEngine().start(style, volume);
    // We don't stop on unmount — the engine is process-singleton so
    // the same buffer loops across re-renders. Stop only when style
    // is explicitly 'none'.
  }, [style, volume]);

  // Also react to volume changes mid-play.
  useEffect(() => {
    if (style !== 'none') getEngine().setVolume(volume);
  }, [volume, style]);
}
