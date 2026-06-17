// Animated wallpapers — three pure-CSS / pure-SVG variants that sit
// behind the entire app. Cheap on the GPU (no JS animation, just
// CSS keyframes), and respect intensity via a single opacity prop.

import { useMemo } from 'react';

export type WallpaperStyle = 'aurora' | 'stars' | 'rain';

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
  return <Rain intensity={intensity} />;
}

function Aurora({ intensity, isDark: dark }: { intensity: number; isDark: boolean }) {
  // Two soft color blobs that drift across the screen. Pick accent
  // colors that match the theme so it doesn't clash.
  const a = dark ? 'rgba(120, 80, 200, 0.55)' : 'rgba(255, 200, 120, 0.55)';
  const b = dark ? 'rgba(40, 180, 200, 0.45)' : 'rgba(120, 200, 255, 0.45)';
  const c = dark ? 'rgba(255, 120, 200, 0.35)' : 'rgba(200, 120, 255, 0.35)';
  const alpha = (n: number) => Math.min(1, intensity * n);

  // Random fixed positions so the blobs don't sit in identical spots
  // each mount. Seeded by index for stability.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
