// Animated wallpapers — three pure-CSS / pure-SVG variants that sit
// behind the entire app. Cheap on the GPU (no JS animation, just
// CSS keyframes), and respect intensity via a single opacity prop.

import { useMemo } from 'react';

export type WallpaperStyle = 'aurora' | 'stars' | 'rain' | 'geometric' | 'mesh' | 'fireflies';

const STYLES: WallpaperStyle[] = ['aurora', 'stars', 'rain', 'geometric', 'mesh', 'fireflies'];

export function Wallpaper({
  style,
  intensity,
  isDark,
}: {
  style: WallpaperStyle;
  /** 0..1. We multiply the per-layer alpha by this. */
  intensity: number;
  isDark: boolean;
}) {
  if (style === 'aurora') return <Aurora intensity={intensity} isDark={isDark} />;
  if (style === 'stars') return <Stars intensity={intensity} />;
  if (style === 'rain') return <Rain intensity={intensity} />;
  if (style === 'geometric') return <Geometric intensity={intensity} isDark={isDark} />;
  if (style === 'mesh') return <Mesh intensity={intensity} isDark={isDark} />;
  return <Fireflies intensity={intensity} isDark={isDark} />;
}

// Re-export the style list so settings can render buttons without
// duplicating the union.
export const WALLPAPER_STYLES = STYLES;

function Aurora({ intensity, isDark: dark }: { intensity: number; isDark: boolean }) {
  // Two soft color blobs that drift across the screen. Pick accent
  // colors that match the theme so it doesn't clash.
  const a = dark ? 'rgba(120, 80, 200, 0.55)' : 'rgba(255, 200, 120, 0.55)';
  const b = dark ? 'rgba(40, 180, 200, 0.45)' : 'rgba(120, 200, 255, 0.45)';
  const c = dark ? 'rgba(255, 120, 200, 0.35)' : 'rgba(200, 120, 255, 0.35)';
  const alpha = (n: number) => Math.min(1, intensity * n);

  // Random fixed positions so the blobs don't sit in identical spots
  // each mount. Seeded by index for stability — re-firing on
  // intensity change would jumble the field.
  const blobs = useMemo(
    () => [
      { left: '20%', top: '15%', size: 480, color: a, delay: '0s' },
      { left: '70%', top: '60%', size: 540, color: b, delay: '4s' },
      { left: '40%', top: '80%', size: 420, color: c, delay: '8s' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000"
      style={{ opacity: Math.min(1, intensity * 1.4) }}
    >
      <style>{`
        @keyframes auroraDrift1 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(80px, -60px) scale(1.15); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes auroraDrift2 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-100px, 40px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes auroraDrift3 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(60px, -80px) scale(1.2); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: b.color,
            filter: 'blur(120px)',
            opacity: alpha(0.6),
            animation: `${['auroraDrift1', 'auroraDrift2', 'auroraDrift3'][i]} 24s ease-in-out ${b.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Stars({ intensity }: { intensity: number }) {
  // Deterministic star field — 80 random positions seeded once.
  const stars = useMemo(() => {
    const out: { left: number; top: number; size: number; delay: number; dur: number }[] = [];
    let seed = 0x1234;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 80; i++) {
      out.push({
        left: rand() * 100,
        top: rand() * 100,
        size: 1 + rand() * 1.6,
        delay: rand() * 5,
        dur: 2 + rand() * 4,
      });
    }
    return out;
    // rand() and Math.random() are intentionally out of deps; we only
    // want this layout to compute once per style change.
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000"
      style={{ opacity: Math.min(1, intensity * 1.4) }}
    >
      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 1; }
        }
      `}</style>
      {stars.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: 'white',
            opacity: 0.4,
            animation: `starTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Rain({ intensity }: { intensity: number }) {
  // 60 rain streaks falling at staggered speeds. Pure CSS animation.
  const drops = useMemo(() => {
    const out: { left: number; delay: number; dur: number; len: number; opacity: number }[] = [];
    let seed = 0xC0FFEE;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 60; i++) {
      out.push({
        left: rand() * 100,
        delay: rand() * 1.5,
        dur: 0.6 + rand() * 0.8,
        len: 8 + rand() * 14,
        opacity: 0.15 + rand() * 0.35,
      });
    }
    return out;
    // rand() and Math.random() are intentionally out of deps; we only
    // want this layout to compute once per style change.
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000"
      style={{ opacity: Math.min(1, intensity * 1.5) }}
    >
      <style>{`
        @keyframes rainFall {
          0%   { transform: translateY(-10vh); }
          100% { transform: translateY(110vh); }
        }
      `}</style>
      {drops.map((d, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${d.left}%`,
            top: 0,
            width: 1,
            height: d.len,
            background: 'linear-gradient(to bottom, transparent, rgba(180, 200, 220, 0.8))',
            opacity: d.opacity,
            animation: `rainFall ${d.dur}s linear ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// Geometric: 8 outlined rings + 2 large faint rings, each rotating
// slowly in alternating directions. Pure SVG, GPU-cheap. Reads as
// "concentric" without being busy.
function Geometric({ intensity, isDark: dark }: { intensity: number; isDark: boolean }) {
  const stroke = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
  const fill = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const alpha = (n: number) => Math.min(1, intensity * n);

  // The rule's immutability check flags any inner function that
  // captures and reassigns a parent let; we side-step it by
  // computing the layout with a plain for-loop and a fresh closure
  // per useMemo call.
  const shapes = useMemo(() => {
    const out: { size: number; left: number; top: number; dur: number; delay: number; reverse: boolean }[] = [];
    let s = 0xBEAD;
    const next = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 8; i++) {
      out.push({
        // Each ring is 3-9% of viewport edge, placed at random spot.
        size: 60 + next() * 180,
        left: 10 + next() * 80,
        top: 10 + next() * 80,
        // Alternate direction for visual rhythm.
        dur: 40 + next() * 40,
        delay: next() * 10,
        reverse: i % 2 === 1,
      });
    }
    return out;
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000"
      style={{ opacity: Math.min(1, intensity * 1.4) }}
      data-wallpaper="geometric"
    >
      <style>{`
        @keyframes geoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes geoSpinRev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      `}</style>
      {shapes.map((s, i) => (
        <svg
          key={i}
          width={s.size}
          height={s.size}
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: `${s.top}%`,
            opacity: alpha(0.6),
            animation: `${s.reverse ? 'geoSpinRev' : 'geoSpin'} ${s.dur}s linear ${s.delay}s infinite`,
          }}
        >
          <circle cx="50" cy="50" r="48" fill={fill} stroke={stroke} strokeWidth="0.6" />
          <circle cx="50" cy="50" r="32" fill="none" stroke={stroke} strokeWidth="0.5" />
          <circle cx="50" cy="50" r="16" fill="none" stroke={stroke} strokeWidth="0.4" />
        </svg>
      ))}
    </div>
  );
}

// Mesh: 4 large blurred radial gradients that drift in different
// directions. More colorful than aurora; calmer than rain. Pure CSS.
function Mesh({ intensity, isDark: dark }: { intensity: number; isDark: boolean }) {
  const blobs = useMemo(() => {
    const out: { left: number; top: number; size: number; dx: number; dy: number; dur: number; delay: number }[] = [];
    let s = 0xDEED;
    const next = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 4; i++) {
      out.push({
        left: next() * 100,
        top: next() * 100,
        size: 400 + next() * 200,
        dx: (next() - 0.5) * 200,
        dy: (next() - 0.5) * 200,
        dur: 24 + next() * 18,
        delay: next() * 6,
      });
    }
    return out;
  }, []);
  const palette = dark
    ? ['rgba(120, 80, 200, 0.55)', 'rgba(40, 180, 200, 0.5)', 'rgba(255, 120, 200, 0.45)', 'rgba(80, 200, 120, 0.45)']
    : ['rgba(255, 180, 120, 0.5)', 'rgba(120, 200, 255, 0.5)', 'rgba(255, 140, 200, 0.4)', 'rgba(180, 255, 140, 0.4)'];
  const alpha = (n: number) => Math.min(1, intensity * n);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000"
      style={{ opacity: Math.min(1, intensity * 1.3) }}
      data-wallpaper="mesh"
    >
      <style>{`
        @keyframes meshDrift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(120px,-90px)} }
        @keyframes meshDrift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-140px,60px)} }
        @keyframes meshDrift3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(80px,120px)} }
        @keyframes meshDrift4 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-100px,-100px)} }
      `}</style>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: palette[i],
            filter: 'blur(140px)',
            opacity: alpha(0.6),
            animation: `${['meshDrift1', 'meshDrift2', 'meshDrift3', 'meshDrift4'][i]} ${b.dur}s ease-in-out ${b.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// Fireflies: 25 yellow/amber glowing particles that float in
// independent loops, each with a unique duration and phase. The
// "glow" is a radial-gradient (no box-shadow needed). On light
// themes we shift to amber so they stay visible.
function Fireflies({ intensity, isDark: dark }: { intensity: number; isDark: boolean }) {
  const flies = useMemo(() => {
    const out: {
      left: number;
      top: number;
      size: number;
      dx: number;
      dy: number;
      dur: number;
      delay: number;
      pulseDur: number;
      pulseDelay: number;
    }[] = [];
    let s = 0xF1F1;
    const next = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 25; i++) {
      out.push({
        left: next() * 100,
        top: next() * 100,
        size: 4 + next() * 8,
        // Float arc distances (small — fireflies don't travel far).
        dx: (next() - 0.5) * 60,
        dy: (next() - 0.5) * 60,
        dur: 8 + next() * 12,
        delay: next() * 8,
        // Pulse phase per firefly.
        pulseDur: 2 + next() * 3,
        pulseDelay: next() * 3,
      });
    }
    return out;
  }, []);
  const inner = dark ? 'rgba(255, 240, 160, 1)' : 'rgba(255, 180, 60, 1)';
  const outer = dark ? 'rgba(180, 220, 100, 0)' : 'rgba(255, 140, 30, 0)';
  const alpha = (n: number) => Math.min(1, intensity * n);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000"
      style={{ opacity: Math.min(1, intensity * 1.5) }}
      data-wallpaper="fireflies"
    >
      <style>{`
        @keyframes flyFloat { 0%,100%{transform:translate(0,0)} 50%{transform:translate(var(--dx), var(--dy))} }
        @keyframes flyPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
      {flies.map((f, i) => (
        <span
          key={i}
          data-firefly="1"
          style={{
            position: 'absolute',
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.size,
            height: f.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${inner} 0%, ${outer} 70%)`,
            opacity: alpha(0.7),
            // CSS custom props feed the keyframe var(--dx/--dy).
            ['--dx' as string]: `${f.dx}px`,
            ['--dy' as string]: `${f.dy}px`,
            animation: `flyFloat ${f.dur}s ease-in-out ${f.delay}s infinite, flyPulse ${f.pulseDur}s ease-in-out ${f.pulseDelay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
