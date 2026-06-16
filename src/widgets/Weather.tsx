import { useEffect, useState, useCallback, useRef } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Eye, Gauge, RefreshCw, MapPin } from 'lucide-react';
import type { ThemeName } from './clock-constants';

interface WeatherData {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  visibility: number;
  pressure: number;
  code: number;
  desc: string;
  city: string;
  country?: string;
  timezone?: string;
  updatedAt: number;
  forecast: { date: string; high: number; low: number; code: number; desc: string }[];
}

interface Coords { lat: number; lon: number }

const ICONS: Record<number, typeof Sun> = {
  0: Sun, 1: Sun, 2: Cloud, 3: Cloud, 45: Cloud, 48: Cloud,
  51: CloudRain, 53: CloudRain, 55: CloudRain,
  61: CloudRain, 63: CloudRain, 65: CloudRain,
  71: CloudSnow, 73: CloudSnow, 75: CloudSnow,
  80: CloudRain, 81: CloudRain, 82: CloudRain,
  95: CloudLightning, 96: CloudLightning, 99: CloudLightning,
};

const DESCRIPTIONS: Record<number, string> = {
  0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime Fog',
  51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
  61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
  80: 'Rain Showers', 81: 'Heavy Showers', 82: 'Violent Showers',
  95: 'Thunderstorm', 96: 'Thunder + Hail', 99: 'Severe Thunder',
};

// Built-in city → coords fallback. Avoids geocoding entirely for common cities
// and gracefully degrades for unknowns (Open-Meteo's free geocoding API).
const CITY_COORDS: Record<string, Coords & { country: string; tz: string }> = {
  jakarta: { lat: -6.2088, lon: 106.8456, country: 'ID', tz: 'Asia/Jakarta' },
  'new york': { lat: 40.7128, lon: -74.006, country: 'US', tz: 'America/New_York' },
  nyc: { lat: 40.7128, lon: -74.006, country: 'US', tz: 'America/New_York' },
  london: { lat: 51.5074, lon: -0.1278, country: 'GB', tz: 'Europe/London' },
  tokyo: { lat: 35.6762, lon: 139.6503, country: 'JP', tz: 'Asia/Tokyo' },
  sydney: { lat: -33.8688, lon: 151.2093, country: 'AU', tz: 'Australia/Sydney' },
  singapore: { lat: 1.3521, lon: 103.8198, country: 'SG', tz: 'Asia/Singapore' },
  bangkok: { lat: 13.7563, lon: 100.5018, country: 'TH', tz: 'Asia/Bangkok' },
  dubai: { lat: 25.2048, lon: 55.2708, country: 'AE', tz: 'Asia/Dubai' },
  paris: { lat: 48.8566, lon: 2.3522, country: 'FR', tz: 'Europe/Paris' },
  berlin: { lat: 52.52, lon: 13.405, country: 'DE', tz: 'Europe/Berlin' },
  moscow: { lat: 55.7558, lon: 37.6173, country: 'RU', tz: 'Europe/Moscow' },
  'hong kong': { lat: 22.3193, lon: 114.1694, country: 'HK', tz: 'Asia/Hong_Kong' },
  seoul: { lat: 37.5665, lon: 126.978, country: 'KR', tz: 'Asia/Seoul' },
  beijing: { lat: 39.9042, lon: 116.4074, country: 'CN', tz: 'Asia/Shanghai' },
  shanghai: { lat: 31.2304, lon: 121.4737, country: 'CN', tz: 'Asia/Shanghai' },
  istanbul: { lat: 41.0082, lon: 28.9784, country: 'TR', tz: 'Europe/Istanbul' },
  cairo: { lat: 30.0444, lon: 31.2357, country: 'EG', tz: 'Africa/Cairo' },
  'los angeles': { lat: 34.0522, lon: -118.2437, country: 'US', tz: 'America/Los_Angeles' },
  la: { lat: 34.0522, lon: -118.2437, country: 'US', tz: 'America/Los_Angeles' },
  chicago: { lat: 41.8781, lon: -87.6298, country: 'US', tz: 'America/Chicago' },
  toronto: { lat: 43.6532, lon: -79.3832, country: 'CA', tz: 'America/Toronto' },
  'san francisco': { lat: 37.7749, lon: -122.4194, country: 'US', tz: 'America/Los_Angeles' },
  sf: { lat: 37.7749, lon: -122.4194, country: 'US', tz: 'America/Los_Angeles' },
  mexico: { lat: 19.4326, lon: -99.1332, country: 'MX', tz: 'America/Mexico_City' },
  'mexico city': { lat: 19.4326, lon: -99.1332, country: 'MX', tz: 'America/Mexico_City' },
  'sao paulo': { lat: -23.5505, lon: -46.6333, country: 'BR', tz: 'America/Sao_Paulo' },
  'kuala lumpur': { lat: 3.139, lon: 101.6869, country: 'MY', tz: 'Asia/Kuala_Lumpur' },
  bandung: { lat: -6.9175, lon: 107.6191, country: 'ID', tz: 'Asia/Jakarta' },
  surabaya: { lat: -7.2575, lon: 112.7521, country: 'ID', tz: 'Asia/Jakarta' },
  bali: { lat: -8.4095, lon: 115.1889, country: 'ID', tz: 'Asia/Makassar' },
  denpasar: { lat: -8.6705, lon: 115.2126, country: 'ID', tz: 'Asia/Makassar' },
  yogyakarta: { lat: -7.7956, lon: 110.3695, country: 'ID', tz: 'Asia/Jakarta' },
  medan: { lat: 3.5952, lon: 98.6722, country: 'ID', tz: 'Asia/Jakarta' },
};

async function geocode(name: string): Promise<(Coords & { country: string; tz?: string }) | null> {
  const key = name.trim().toLowerCase();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: { latitude: number; longitude: number; country_code?: string; timezone?: string }[] };
    const hit = j.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude, country: hit.country_code ?? '', tz: hit.timezone };
  } catch {
    return null;
  }
}

export function Weather({
  theme = 'dark',
  city = 'Jakarta',
  refreshMs = 10 * 60_000, // refresh every 10 min
}: {
  theme?: ThemeName;
  city?: string;
  refreshMs?: number;
}) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setLoading(true);
    try {
      const geo = await geocode(city);
      if (!geo) {
        setError(`Unknown city: ${city}`);
        setLoading(false);
        return;
      }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,visibility,surface_pressure,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) {
        setError(`Weather API error: ${r.status}`);
        setLoading(false);
        return;
      }
      const j = (await r.json()) as { current?: Record<string, number> };
      const c = j.current;
      if (!c) {
        setError('Weather data unavailable');
        setLoading(false);
        return;
      }
      // 3-day forecast (skip index 0 which is today). Open-Meteo returns
      // arrays of length forecast_days; index 0 = today, 1..3 = next 3.
      const d = j.daily;
      const forecast: WeatherData['forecast'] = d
        ? d.time.slice(1, 4).map((date, i) => ({
            date,
            high: Math.round(d.temperature_2m_max[i + 1]),
            low: Math.round(d.temperature_2m_min[i + 1]),
            code: d.weather_code[i + 1],
            desc: DESCRIPTIONS[d.weather_code[i + 1]] || 'Unknown',
          }))
        : [];
      setData({
        temp: Math.round(c.temperature_2m),
        feels: Math.round(c.apparent_temperature),
        humidity: c.relative_humidity_2m,
        wind: c.wind_speed_10m,
        visibility: Math.round(c.visibility / 1000),
        pressure: Math.round(c.surface_pressure),
        code: c.weather_code,
        desc: DESCRIPTIONS[c.weather_code] || 'Unknown',
        city: city.trim(),
        country: geo.country,
        timezone: geo.tz,
        updatedAt: Date.now(),
        forecast,
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    // Initial load + auto-refresh interval. This is the standard
    // "subscribe to external data" pattern; setState in callbacks is
    // exactly what the rule allows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = window.setInterval(() => void load(), refreshMs);
    // Tick "now" once a minute so the "updated N min ago" hint stays fresh
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
      abortRef.current?.abort();
    };
  }, [load, refreshMs]);

  const labelClass = theme === 'dark' ? 'text-white/60' : theme === 'claude' ? 'text-[#3a2e1f]/70' : 'text-black/70';
  const muteClass = theme === 'dark' ? 'text-white/80' : theme === 'claude' ? 'text-[#3a2e1f]/80' : 'text-black/80';

  if (error) {
    return (
      <div className="text-sm flex items-center gap-2">
        <span className={labelClass}>⚠ {error}</span>
        <button
          type="button"
          onClick={() => void load()}
          className={`p-1 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
          aria-label="Retry weather"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className={`text-sm ${labelClass}`}>Loading weather for {city}…</div>;
  }

  const Icon = ICONS[data.code] || Sun;
  const updatedMin = Math.max(0, Math.round((now - data.updatedAt) / 60_000));
  // Whether the current condition is animated (rain, snow, lightning).
  // The icon component itself has no internal animation; we apply
  // a CSS class to nudge the lucide SVG with a subtle motion.
  const isRain = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(data.code);
  const isSnow = [71, 73, 75, 77].includes(data.code);
  const isLightning = [95, 96, 99].includes(data.code);
  const iconClass = isRain
    ? 'animate-[rain_1.4s_linear_infinite]'
    : isSnow
    ? 'animate-[snow_2.4s_linear_infinite]'
    : isLightning
    ? 'animate-pulse'
    : '';

  return (
    <div className="text-sm">
      <style>{`
        @keyframes rain { 0% { transform: translateY(-1px); } 100% { transform: translateY(1px); } }
        @keyframes snow { 0% { transform: translate(0,0) rotate(0); } 50% { transform: translate(-1px,1px) rotate(5deg); } 100% { transform: translate(0,0) rotate(0); } }
      `}</style>
      <div className={`text-xs mb-2 flex items-center gap-1 ${labelClass}`}>
        <MapPin className="w-3 h-3" />
        {data.city}{data.country ? `, ${data.country}` : ''}
        {loading && <RefreshCw className="w-3 h-3 animate-spin ml-1 opacity-60" />}
      </div>
      <div className="flex items-baseline gap-3 mb-3">
        <Icon className={`w-8 h-8 -translate-y-1 ${iconClass}`} />
        <div className="text-5xl font-thin tabular-nums">{data.temp}°</div>
      </div>
      <div className={`text-xs mb-3 ${muteClass}`}>{data.desc} · feels {data.feels}°</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className={`flex items-center gap-1.5 ${muteClass}`}>
          <Droplets className="w-3 h-3" /> {data.humidity}%
        </div>
        <div className={`flex items-center gap-1.5 ${muteClass}`}>
          <Wind className="w-3 h-3" /> {data.wind} km/h
        </div>
        <div className={`flex items-center gap-1.5 ${muteClass}`}>
          <Eye className="w-3 h-3" /> {data.visibility} km
        </div>
        <div className={`flex items-center gap-1.5 ${muteClass}`}>
          <Gauge className="w-3 h-3" /> {data.pressure} hPa
        </div>
      </div>
      {data.forecast.length > 0 && (
        <div
          className={`mt-3 pt-2 border-t ${isDark ? 'border-white/10' : isClaude ? 'border-[#3a2e1f]/15' : 'border-black/10'}`}
        >
          <div className={`text-[10px] uppercase tracking-widest opacity-60 mb-1.5 ${labelClass}`}>
            3-day
          </div>
          <div className="grid grid-cols-3 gap-2">
            {data.forecast.map((f) => {
              const FIcon = ICONS[f.code] || Sun;
              return (
                <div key={f.date} className="flex flex-col items-center gap-0.5">
                  <div className={`text-[10px] ${labelClass}`}>
                    {new Date(f.date).toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <FIcon className="w-4 h-4 opacity-80" />
                  <div className={`text-[10px] tabular-nums ${muteClass}`}>
                    {f.high}° / <span className="opacity-60">{f.low}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {updatedMin > 0 && (
        <div className={`text-[10px] mt-2 opacity-50 ${labelClass}`}>
          updated {updatedMin}m ago
        </div>
      )}
    </div>
  );
}
