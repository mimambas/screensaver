// WebAudio synth-based ambient sound. We don't ship any audio
// files — instead we generate brown/white noise + simple filtering
// in the browser. Three styles:
//   - rain:  filtered white noise (bandpass ~1.5kHz)
//   - forest: brown noise (low-passed, very low freq) + occasional chirps
//   - white:  flat white noise
//
// Volume slider scales the master gain. Mute cuts it to zero.

import { useEffect, useRef } from 'react';

export type AmbientStyle = 'rain' | 'forest' | 'white';

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private chirpTimer: number | null = null;
  private style: AmbientStyle | null = null;

  start(style: AmbientStyle, volume: number) {
    if (this.style === style && this.ctx) {
      // Already running this style — just update volume.
      if (this.master) this.master.gain.value = Math.max(0, Math.min(1, volume));
      return;
    }
    this.stop();
    this.style = style;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    const ctx = this.ctx;
    // 2 seconds of pre-generated noise loops forever; cheap on CPU.
    const buf = this.makeNoiseBuffer(ctx, 2, style);
    this.source = ctx.createBufferSource();
    this.source.buffer = buf;
    this.source.loop = true;
    this.master = ctx.createGain();
    this.master.gain.value = Math.max(0, Math.min(1, volume));
    this.filter = ctx.createBiquadFilter();
    if (style === 'rain') {
      this.filter.type = 'bandpass';
      this.filter.frequency.value = 1500;
      this.filter.Q.value = 0.5;
    } else if (style === 'forest') {
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 600;
    } else {
      this.filter.type = 'allpass';
    }
    this.source.connect(this.filter).connect(this.master).connect(ctx.destination);
    this.source.start(0);

    if (style === 'forest') {
      // Schedule an occasional chirp. Bird-ish sine sweep in the
      // 2-3kHz range, 80-150ms long, every 4-12s.
      const schedule = () => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const dur = 0.08 + Math.random() * 0.07;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000 + Math.random() * 800, now);
        osc.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 600, now + dur);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.08, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(g).connect(this.master!);
        osc.start(now);
        osc.stop(now + dur + 0.01);
        const next = 4000 + Math.random() * 8000;
        this.chirpTimer = window.setTimeout(schedule, next);
      };
      schedule();
    }
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  stop() {
    if (this.chirpTimer !== null) {
      window.clearTimeout(this.chirpTimer);
      this.chirpTimer = null;
    }
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.filter) {
      this.filter.disconnect();
      this.filter = null;
    }
    if (this.master) {
      this.master.disconnect();
      this.master = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.style = null;
  }

  private makeNoiseBuffer(ctx: AudioContext, durationSec: number, style: AmbientStyle): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (style === 'forest') {
      // Brown noise — integrate white noise.
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    } else {
      // White noise for rain and white.
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return buf;
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
  styleRef.current = style;
  volRef.current = volume;

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
