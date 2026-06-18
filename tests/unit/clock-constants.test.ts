// clock-constants unit tests. Pure functions — no React, no DOM,
// no audio. Just arithmetic + string parsing. These tests run in
// well under 100ms and form the bottom layer of our test pyramid.

import { describe, expect, it } from 'vitest';
import {
  CLOCK_SIZE_PRESETS,
  clampClockSize,
  getColor,
  getSizeScale,
  normalizeHex,
  safeDarkBgColor,
} from '../../src/widgets/clock-constants';

describe('clampClockSize', () => {
  const { min, max } = CLOCK_SIZE_PRESETS;

  it('returns the input unchanged when in range', () => {
    expect(clampClockSize(1.0)).toBe(1.0);
    expect(clampClockSize(1.5)).toBe(1.5);
    expect(clampClockSize(min)).toBe(min);
    expect(clampClockSize(max)).toBe(max);
  });

  it('clamps to min when below range', () => {
    expect(clampClockSize(0.1)).toBe(min);
    expect(clampClockSize(0)).toBe(min);
    expect(clampClockSize(-5)).toBe(min);
  });

  it('clamps to max when above range', () => {
    expect(clampClockSize(5)).toBe(max);
    expect(clampClockSize(999)).toBe(max);
  });

  it('rounds to one decimal place', () => {
    // The hook does Math.round(n * 10) / 10 to keep the storage
    // shape tidy. 1.234 → 1.2.
    expect(clampClockSize(1.234)).toBe(1.2);
    expect(clampClockSize(1.789)).toBe(1.8);
  });

  it('returns default when input is non-finite', () => {
    // NaN falls through `typeof === number` and `Number.isFinite`
    // returns false → n = 1 → Math.max(0.5, Math.min(3, 1)) = 1.
    expect(clampClockSize(Number.NaN)).toBe(1);
  });
});

describe('getSizeScale', () => {
  it('returns the input when a finite number', () => {
    expect(getSizeScale(1.5)).toBe(1.5);
    expect(getSizeScale(0.7)).toBe(0.7);
  });

  it('defaults to 1 when undefined or non-finite', () => {
    expect(getSizeScale(undefined)).toBe(1);
    expect(getSizeScale(Number.NaN)).toBe(1);
  });
});

describe('normalizeHex', () => {
  it('accepts 6-char hex with hash', () => {
    expect(normalizeHex('#a78bfa')).toBe('#a78bfa');
    expect(normalizeHex('#FF3344')).toBe('#ff3344');
  });

  it('accepts 6-char hex without hash', () => {
    expect(normalizeHex('a78bfa')).toBe('#a78bfa');
  });

  it('expands 3-char shorthand to 6-char', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('fab')).toBe('#ffaabb');
  });

  it('lowercases the result', () => {
    expect(normalizeHex('#ABCDEF')).toBe('#abcdef');
    expect(normalizeHex('#FFF')).toBe('#ffffff');
  });

  it('trims whitespace', () => {
    expect(normalizeHex('  #abc  ')).toBe('#aabbcc');
  });

  it('rejects invalid hex', () => {
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('#xyz')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull(); // 5 chars, neither 3 nor 6
    expect(normalizeHex('#1234567')).toBeNull(); // 7 chars
    expect(normalizeHex('#ggg')).toBeNull();
  });

  it('rejects non-strings gracefully', () => {
    // @ts-expect-error — testing runtime behavior, not types
    expect(normalizeHex(null)).toBeNull();
    // @ts-expect-error — testing runtime behavior, not types
    expect(normalizeHex(undefined)).toBeNull();
    // @ts-expect-error — testing runtime behavior, not types
    expect(normalizeHex(123)).toBeNull();
  });
});

describe('getColor', () => {
  it('returns the preset hex for a known id', () => {
    expect(getColor('white')).toBe('#ffffff');
    expect(getColor('amber')).toBe('#ffb000');
    expect(getColor('ink')).toBe('#0a0a0a');
  });

  it('returns custom hex when color === "custom" and hex provided', () => {
    expect(getColor('custom', '#a78bfa')).toBe('#a78bfa');
  });

  it('falls back to white when custom is set without hex', () => {
    expect(getColor('custom')).toBe('#ffffff');
  });

  it('returns white for an unknown color id', () => {
    // @ts-expect-error — testing runtime safety
    expect(getColor('not-a-color')).toBe('#ffffff');
  });
});

describe('safeDarkBgColor', () => {
  it('replaces ink with white (it disappears into dark backgrounds)', () => {
    expect(safeDarkBgColor('ink')).toBe('white');
  });

  it('passes other colors through', () => {
    expect(safeDarkBgColor('amber')).toBe('amber');
    expect(safeDarkBgColor('white')).toBe('white');
    expect(safeDarkBgColor('custom')).toBe('custom');
  });
});
