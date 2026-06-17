// Guided breathing exercise — 4-7-8 / box breathing / coherent
// breathing patterns. Renders an animated circle that expands on
// "inhale", holds on "hold", contracts on "exhale". Optional soft
// chime at each phase boundary. Pure WebAudio + CSS keyframes —
// honors `prefers-reduced-motion` (animation frozen, but the
// counter still advances so the user can follow the cadence).

import { useEffect, useRef, useState, useCallback } from 'react';
import { Wind, Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { playChime, unlockAudio } from './audio';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import type { ThemeName } from './clock-constants';
import { THEMES } from './theme-presets';
import { useT } from '../i18n';

type Pattern = '478' | 'box' | 'coherent';

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

const PATTERNS: Record<Pattern, { name: string; phases: { phase: Phase; sec: number }[]; cyclesDefault: number }> = {
  // 4-7-8 (Andrew Weil) — calming, pre-sleep.
  '478': {
    name: '4-7-8',
    phases: [
      { phase: 'inhale', sec: 4 },
      { phase: 'hold-in', sec: 7 },
      { phase: 'exhale', sec: 8 },
    ],
    cyclesDefault: 4,
  },
  // Box breathing (Navy SEALs) — focus + stress reset.
  'box': {
    name: 'Box',
    phases: [
      { phase: 'inhale', sec: 4 },
      { phase: 'hold-in', sec: 4 },
      { phase: 'exhale', sec: 4 },
      { phase: 'hold-out', sec: 4 },
    ],
    cyclesDefault: 6,
  },
  // Coherent breathing (5.5s in, 5.5s out) — HRV / parasympathetic.
  'coherent': {
    name: 'Coherent',
    phases: [
      { phase: 'inhale', sec: 6 },
      { phase: 'exhale', sec: 6 },
    ],
    cyclesDefault: 8,
  },
};

const PHASE_LABEL: Record<Phase, { en: string; id: string }> = {
  'inhale':   { en: 'Breathe in',  id: 'Tarik napas' },
  'hold-in':  { en: 'Hold',        id: 'Tahan' },
  'exhale':   { en: 'Breathe out', id: 'Hembuskan' },
  'hold-out': { en: 'Hold',        id: 'Tahan' },
};

export function Breathing({ theme = 'dark' }: { theme?: ThemeName }) {
  const t = useT();
  const reduced = usePrefersReducedMotion();
  const palette = THEMES[theme];

  const [pattern, setPattern] = useState<Pattern>('478');
  const [cyclesTarget, setCyclesTarget] = useState(PATTERNS['478'].cyclesDefault);
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseElapsedMs, setPhaseElapsedMs] = useState(0);
  const [cyclesDone, setCyclesDone] = useState(0);
  const [sound, setSound] = useState(true);
  const startedAtRef = useRef<number | null>(null);

  // Auto-pause when the user picks a new pattern mid-run. We fold
  // the pause into the click handler instead of an effect.
  const pause = useCallback(() => {
    setRunning(false);
    startedAtRef.current = null;
  }, []);
  const selectPattern = useCallback((p: Pattern) => {
    setPattern(p);
    setCyclesTarget(PATTERNS[p].cyclesDefault);
    setPhaseIdx(0);
    setPhaseElapsedMs(0);
    setCyclesDone(0);
    pause();
  }, [pause]);
  // Audio unlock on first user interaction.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('mousemove', unlock, { once: true, capture: true });
    window.addEventListener('click', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('mousemove', unlock, { capture: true });
      window.removeEventListener('click', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  // rAF-driven phase ticker. We don't depend on the pattern/cycles
  // target so the loop stays stable mid-session; refs read the
  // freshest values.
  const patternRef = useRef(pattern);
  const cyclesTargetRef = useRef(cyclesTarget);
  useEffect(() => {
    patternRef.current = pattern;
    cyclesTargetRef.current = cyclesTarget;
  }, [pattern, cyclesTarget]);

  useEffect(() => {
    if (!running) {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      if (startedAtRef.current === null) return;
      const elapsed = performance.now() - startedAtRef.current;
      const pat = PATTERNS[patternRef.current];
      // Walk the phase list, advancing as we go.
      let acc = 0;
      let idx = 0;
      for (let i = 0; i < pat.phases.length; i++) {
        const p = pat.phases[i];
        if (elapsed < acc + p.sec * 1000) {
          idx = i;
          break;
        }
        acc += p.sec * 1000;
        idx = i + 1;
      }
      if (idx >= pat.phases.length) {
        // One full cycle done. Bump counter, restart at phase 0.
        const cycles = Math.floor(elapsed / pat.phases.reduce((s, p) => s + p.sec * 1000, 0));
        const newCycles = cycles; // 1-based
        if (newCycles > cyclesDone && sound) playChime();
        setCyclesDone(newCycles);
        if (newCycles >= cyclesTargetRef.current) {
          setRunning(false);
          setPhaseIdx(0);
          setPhaseElapsedMs(0);
          setCyclesDone(0);
          if (sound) playChime();
          return;
        }
        // Continue the same rAF — restart the cycle baseline.
        startedAtRef.current = performance.now() - (elapsed % pat.phases.reduce((s, p) => s + p.sec * 1000, 0));
        setPhaseIdx(0);
        setPhaseElapsedMs(0);
        raf = window.requestAnimationFrame(tick);
        return;
      }
      setPhaseIdx(idx);
      setPhaseElapsedMs(elapsed - acc);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // cyclesDone is read inside the loop via the React state, but
    // we capture it in the closure; cycling in render resets the
    // startedAt baseline so the loop is well-behaved.
  }, [running, sound, cyclesDone]);

  const reset = useCallback(() => {
    setRunning(false);
    setPhaseIdx(0);
    setPhaseElapsedMs(0);
    setCyclesDone(0);
  }, []);

  const phases = PATTERNS[pattern].phases;
  const current = phases[phaseIdx] ?? phases[0];
  const phaseMs = current.sec * 1000;
  // Phase progress 0..1. Drives the circle's scale via CSS var.
  const phaseProgress = Math.min(1, phaseMs > 0 ? phaseElapsedMs / phaseMs : 0);
  // Scale: 0.4 (fully exhaled) → 1.0 (fully inhaled).
  const circleScale =
    current?.phase === 'inhale' ? 0.4 + 0.6 * phaseProgress :
    current?.phase === 'hold-in' ? 1.0 :
    current?.phase === 'exhale' ? 1.0 - 0.6 * phaseProgress :
    /* hold-out */ 0.4;

  const phaseKey = current?.phase ?? 'inhale';
  const phaseLabel = t(`breathing.${phaseKey.replace('-', '')}` as 'breathing.inhale') || PHASE_LABEL[phaseKey as Phase].en;
  const phaseTone = palette.isDark ? 'text-white' : 'text-black';

  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border p-4 transition-colors duration-700 ${palette.border}`}>
      <div className={`text-xs uppercase tracking-widest flex items-center gap-1 ${palette.textMuted}`}>
        <Wind className="w-3 h-3" /> {t('breathing.title')}
      </div>
      <div className="flex gap-1 text-[10px]">
        {(Object.keys(PATTERNS) as Pattern[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => selectPattern(p)}
            aria-pressed={pattern === p}
            data-pattern={p}
            className={`px-2 py-1 rounded-full uppercase tracking-widest transition-colors ${
              pattern === p
                ? theme === 'claude' ? 'bg-[#3a2e1f]/15 text-[#3a2e1f]' : `${palette.surface} ${palette.text}`
                : `${palette.textMuted} ${palette.surfaceHover}`
            }`}
          >
            {PATTERNS[p].name}
          </button>
        ))}
      </div>

      <div
        className="relative flex items-center justify-center"
        style={{ width: 180, height: 180 }}
      >
        <style>{`
          @keyframes breatheInhale  { from { transform: scale(0.4); } to { transform: scale(1); } }
          @keyframes breatheExhale  { from { transform: scale(1); }   to { transform: scale(0.4); } }
        `}</style>
        {/* Outer guide ring — fixed. */}
        <div
          className={`absolute inset-2 rounded-full border ${palette.border}`}
          style={{ opacity: 0.4 }}
        />
        {/* Animated breath circle. CSS animation when motion is OK,
            driven by JS state when reduced motion is on. */}
        <div
          className="rounded-full"
          data-breath="1"
          style={{
            width: 120,
            height: 120,
            background: palette.isDark
              ? 'radial-gradient(circle, rgba(180, 220, 240, 0.45) 0%, rgba(80, 140, 200, 0.10) 70%)'
              : 'radial-gradient(circle, rgba(80, 140, 200, 0.25) 0%, rgba(40, 100, 160, 0.05) 70%)',
            boxShadow: palette.isDark
              ? '0 0 60px rgba(140, 200, 240, 0.35)'
              : '0 0 60px rgba(100, 160, 220, 0.25)',
            transform: `scale(${reduced ? circleScale : 1})`,
            // When motion is OK, hand off to CSS so the scale tracks
            // smoothly between React state ticks.
            animation: reduced
              ? 'none'
              : current?.phase === 'inhale'
                ? `breatheInhale ${current.sec}s ease-in-out forwards`
                : current?.phase === 'exhale'
                ? `breatheExhale ${current.sec}s ease-in-out forwards`
                : 'none',
            transition: reduced ? 'transform 200ms ease-out' : 'none',
          }}
        />
        <div
          className={`absolute text-center pointer-events-none`}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={`text-sm font-light tracking-wide ${phaseTone}`}>
            {phaseLabel}
          </div>
          <div className={`text-2xl font-thin tabular-nums mt-1 ${palette.text}`}>
            {Math.max(1, Math.ceil(current.sec - phaseElapsedMs / 1000))}
          </div>
          <div className={`text-[10px] mt-0.5 ${palette.textFaint}`}>
            {t('breathing.cycleOf', { n: cyclesDone + 1, total: cyclesTarget })}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? t('breathing.pause') : t('breathing.start')}
          className={`p-2 rounded-full transition-colors ${palette.surfaceHover}`}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label={t('common.reset')}
          className={`p-2 rounded-full transition-colors ${palette.surfaceHover}`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          aria-label={sound ? t('breathing.mute') : t('breathing.unmute')}
          className={`p-2 rounded-full transition-colors ${palette.surfaceHover}`}
        >
          {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
