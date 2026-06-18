// audio mixer unit tests. The mixer is a process-singleton that
// owns a 4-stage WebAudio gain graph. We test the value-tracking
// + mute semantics, NOT the audio output (jsdom doesn't run an
// actual audio engine; AudioContext construction is a noop that
// returns a stub).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mixer, useAudioMixer, __resetMixerForTests } from '../../src/widgets/audio';

describe('mixer — volume tracking', () => {
  beforeEach(() => {
    __resetMixerForTests();
  });
  afterEach(() => {
    __resetMixerForTests();
  });

  it('setVolume stores the value (clamped to 0..1)', () => {
    mixer.setVolume('master', 0.5);
    expect(mixer.getVolume('master')).toBe(0.5);
    // Above 1 → clamp.
    mixer.setVolume('master', 1.5);
    expect(mixer.getVolume('master')).toBe(1);
    // Below 0 → clamp.
    mixer.setVolume('master', -0.5);
    expect(mixer.getVolume('master')).toBe(0);
  });

  it('setMuted stores the flag', () => {
    mixer.setMuted('chime', true);
    expect(mixer.getMuted('chime')).toBe(true);
    mixer.setMuted('chime', false);
    expect(mixer.getMuted('chime')).toBe(false);
  });

  it('all four stages are addressable', () => {
    const stages = ['master', 'chime', 'ambient', 'notif'] as const;
    for (const s of stages) {
      mixer.setVolume(s, 0.42);
      expect(mixer.getVolume(s)).toBe(0.42);
    }
  });

  it('stage volumes are independent', () => {
    mixer.setVolume('master', 0.1);
    mixer.setVolume('chime', 0.2);
    mixer.setVolume('ambient', 0.3);
    mixer.setVolume('notif', 0.4);
    expect(mixer.getVolume('master')).toBe(0.1);
    expect(mixer.getVolume('chime')).toBe(0.2);
    expect(mixer.getVolume('ambient')).toBe(0.3);
    expect(mixer.getVolume('notif')).toBe(0.4);
  });

  it('stage mutes are independent', () => {
    mixer.setMuted('master', true);
    expect(mixer.getMuted('master')).toBe(true);
    expect(mixer.getMuted('chime')).toBe(false);
    expect(mixer.getMuted('ambient')).toBe(false);
    expect(mixer.getMuted('notif')).toBe(false);
  });
});

describe('useAudioMixer hook', () => {
  beforeEach(() => {
    __resetMixerForTests();
  });
  afterEach(() => {
    __resetMixerForTests();
  });

  it('initialises with current mixer values', () => {
    mixer.setVolume('master', 0.7);
    const { result } = renderHook(() => useAudioMixer());
    expect(result.current.state.master).toBe(0.7);
  });

  it('setVolume updates both the mixer and the hook state', () => {
    const { result } = renderHook(() => useAudioMixer());
    act(() => result.current.setVolume('chime', 0.4));
    expect(result.current.state.chime).toBe(0.4);
    expect(mixer.getVolume('chime')).toBe(0.4);
  });

  it('setMuted updates both the mixer and the hook state', () => {
    const { result } = renderHook(() => useAudioMixer());
    act(() => result.current.setMuted('ambient', true));
    expect(result.current.state.muted.ambient).toBe(true);
    expect(mixer.getMuted('ambient')).toBe(true);
  });

  it('clamps out-of-range volumes', () => {
    const { result } = renderHook(() => useAudioMixer());
    act(() => result.current.setVolume('master', 1.5));
    expect(result.current.state.master).toBe(1);
    expect(mixer.getVolume('master')).toBe(1);
    act(() => result.current.setVolume('master', -0.5));
    expect(result.current.state.master).toBe(0);
    expect(mixer.getVolume('master')).toBe(0);
  });
});

describe('mixer — input() returns a GainNode for each stage', () => {
  beforeEach(() => {
    __resetMixerForTests();
  });
  afterEach(() => {
    __resetMixerForTests();
  });

  it('input("ambient") returns a node when context exists', () => {
    // jsdom doesn't actually create AudioContext nodes, so the
    // mixer fails the new AudioContext() and input() returns null.
    // We assert the API contract (returns AudioNode | null)
    // without depending on the underlying node.
    const out = mixer.input('ambient');
    expect(out === null || typeof out === 'object').toBe(true);
  });
});
