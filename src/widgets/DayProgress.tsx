import { useEffect, useState } from 'react';
import { Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import type { ThemeName } from './clock-constants';

interface DayProgressData {
  progress: number; // 0..1
  sunrise: Date | null;
  sunset: Date | null;
  isDay: boolean;
}

interface Coords { lat: number; lon: number; tz?: string }

const CITY_COORDS: Record<string, Coords> = {
  jakarta: { lat: -6.2088, lon: 106.8456, tz: 'Asia/Jakarta' },
  'new york': { lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  nyc: { lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  london: { lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  tokyo: { lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
  sydney: { lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  singapore: { lat: 1.3521, lon: 103.8198, tz: 'Asia/Singapore' },
  bangkok: { lat: 13.7563, lon: 100.5018, tz: 'Asia/Bangkok' },
  dubai: { lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' },
  paris: { lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
  berlin: { lat: 52.52, lon: 13.405, tz: 'Europe/Berlin' },
  moscow: { lat: 55.7558, lon: 37.6173, tz: 'Europe/Moscow' },
  'hong kong': { lat: 22.3193, lon: 114.1694, tz: 'Asia/Hong_Kong' },
  seoul: { lat: 37.5665, lon: 126.978, tz: 'Asia/Seoul' },
  beijing: { lat: 39.9042, lon: 116.4074, tz: 'Asia/Shanghai' },
  shanghai: { lat: 31.2304, lon: 121.4737, tz: 'Asia/Shanghai' },
  istanbul: { lat: 41.0082, lon: 28.9784, tz: 'Europe/Istanbul' },
  cairo: { lat: 30.0444, lon: 31.2357, tz: 'Africa/Cairo' },
  'los angeles': { lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
  la: { lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
  chicago: { lat: 41.8781, lon: -87.6298, tz: 'America/Chicago' },
  toronto: { lat: 43.6532, lon: -79.3832, tz: 'America/Toronto' },
  'san francisco': { lat: 37.7749, lon: -122.4194, tz: 'America/Los_Angeles' },
  sf: { lat: 37.7749, lon: -122.4194, tz: 'America/Los_Angeles' },
  mexico: { lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' },
  'mexico city': { lat: 19.4326, lon: -99.1332, tz: 'America/Mexico_City' },
  'sao paulo': { lat: -23.5505, lon: -46.6333, tz: 'America/Sao_Paulo' },
  'kuala lumpur': { lat: 3.139, lon: 101.6869, tz: 'Asia/Kuala_Lumpur' },
  bandung: { lat: -6.9175, lon: 107.6191, tz: 'Asia/Jakarta' },
  surabaya: { lat: -7.2575, lon: 112.7521, tz: 'Asia/Jakarta' },
  bali: { lat: -8.4095, lon: 115.1889, tz: 'Asia/Makassar' },
  denpasar: { lat: -8.6705, lon: 115.2126, tz: 'Asia/Makassar' },
  yogyakarta: { lat: -7.7956, lon: 110.3695, tz: 'Asia/Jakarta' },
  medan: { lat: 3.5952, lon: 98.6722, tz: 'Asia/Jakarta' },
};

async function geocode(name: string): Promise<Coords | null> {
  const key = name.trim().toLowerCase();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: { latitude: number; longitude: number; timezone?: string }[] };
    const hit = j.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude, tz: hit.timezone };
  } catch {
    return null;
  }
}

function calcDayProgress(now: Date, sunrise: Date | null, sunset: Date | null): number {
  if (!sunrise || !sunset) return now.getHours() / 24 + now.getMinutes() / 1440;
  const t = now.getTime();
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  if (t <= sr) return 0;
  if (t >= ss) return 1;
  return (t - sr) / (ss - sr);
}

function parseOpenMeteoTime(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function DayProgress({
  theme = 'dark',
  city = 'Jakarta',
  refreshMs = 60 * 60_000, // refresh sunrise/sunset hourly
}: {
  theme?: ThemeName;
  city?: string;
  refreshMs?: number;
}) {
  const [data, setData] = useState<DayProgressData | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  // Tick `now` once a minute so the arc animates smoothly.
  useEffect(() => {
    let timeoutId: number;
    let intervalId: number;
    const schedule = () => {
      const ms = 60_000 - (Date.now() % 60_000);
      timeoutId = window.setTimeout(() => {
        setNow(new Date());
        intervalId = window.setInterval(() => setNow(new Date()), 60_000);
      }, ms);
    };
    schedule();
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const geo = await geocode(city);
        if (!geo) {
          if (!cancelled) setError(`Unknown city: ${city}`);
          return;
        }
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
        const r = await fetch(url);
        if (!r.ok) {
          if (!cancelled) setError(`Sun API error: ${r.status}`);
          return;
        }
        const j = (await r.json()) as { daily?: { sunrise?: string[]; sunset?: string[] } };
        const sr = parseOpenMeteoTime(j.daily?.sunrise?.[0]);
        const ss = parseOpenMeteoTime(j.daily?.sunset?.[0]);
        if (cancelled) return;
        setError(null);
        setData({
          progress: calcDayProgress(new Date(), sr, ss),
          sunrise: sr,
          sunset: ss,
          isDay: sr ? new Date() >= sr : false,
        });
      } catch {
        if (!cancelled) setError('Network error');
      }
    };
    void load();
    const id = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [city, refreshMs]);

  // Live recompute of `progress` from latest `now` (no extra fetch).
  const liveProgress = data
    ? calcDayProgress(now, data.sunrise, data.sunset)
    : now.getHours() / 24 + now.getMinutes() / 1440;

  const label =
    theme === 'dark' ? 'text-white/60' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';
  const main =
    theme === 'dark' ? 'text-white' : theme === 'claude' ? 'text-[#3a2e1f]' : 'text-black';

  // Ring geometry
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - liveProgress);
  const angle = -Math.PI / 2 + 2 * Math.PI * liveProgress;
  const dotX = cx + r * Math.cos(angle);
  const dotY = cy + r * Math.sin(angle);

  const fmtTime = (d: Date | null) => {
    if (!d) return '—';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const Icon = data?.isDay ? Sun : Moon;

  if (error) {
    return <div className={`text-xs ${label}`}>⚠ {error}</div>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-xs uppercase tracking-widest flex items-center gap-1 ${label}`}>
        <Icon className="w-3 h-3" /> Day progress
      </div>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            opacity={0.15}
            className={label}
          />
          {/* progress arc — rotates from top, clockwise */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className={main}
            style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
          />
          {/* progress dot at leading edge */}
          <circle
            cx={dotX}
            cy={dotY}
            r={5}
            fill="currentColor"
            className={main}
            style={{ transition: 'cx 800ms ease-out, cy 800ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-3xl font-thin tabular-nums ${main}`}>
            {Math.round(liveProgress * 100)}%
          </div>
          <div className={`text-[10px] ${label}`}>
            {fmtTime(data?.sunrise ?? null)} → {fmtTime(data?.sunset ?? null)}
          </div>
        </div>
      </div>
      <div className={`flex items-center gap-3 text-[10px] ${label}`}>
        <span className="flex items-center gap-1">
          <Sunrise className="w-3 h-3" /> {fmtTime(data?.sunrise ?? null)}
        </span>
        <span className="flex items-center gap-1">
          <Sunset className="w-3 h-3" /> {fmtTime(data?.sunset ?? null)}
        </span>
      </div>
    </div>
  );
}
