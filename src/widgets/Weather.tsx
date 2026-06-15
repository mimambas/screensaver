import { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Eye, Gauge } from 'lucide-react';

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
}

const ICONS: Record<number, typeof Sun> = {
  0: Sun,
  1: Sun,
  2: Cloud,
  3: Cloud,
  45: Cloud,
  48: Cloud,
  51: CloudRain,
  53: CloudRain,
  55: CloudRain,
  61: CloudRain,
  63: CloudRain,
  65: CloudRain,
  71: CloudSnow,
  73: CloudSnow,
  75: CloudSnow,
  80: CloudRain,
  81: CloudRain,
  82: CloudRain,
  95: CloudLightning,
  96: CloudLightning,
  99: CloudLightning,
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

export function Weather() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Default to Jakarta — user can change coordinates
    const lat = -6.2088;
    const lon = 106.8456;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,visibility,surface_pressure,weather_code`;

    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const c = j.current;
        setData({
          temp: Math.round(c.temperature_2m),
          feels: Math.round(c.apparent_temperature),
          humidity: c.relative_humidity_2m,
          wind: c.wind_speed_10m,
          visibility: Math.round(c.visibility / 1000),
          pressure: Math.round(c.surface_pressure),
          code: c.weather_code,
          desc: DESCRIPTIONS[c.weather_code] || 'Unknown',
          city: 'Jakarta',
        });
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="text-sm opacity-50">Weather unavailable</div>;
  if (!data) return <div className="text-sm opacity-50">Loading weather...</div>;

  const Icon = ICONS[data.code] || Sun;

  return (
    <div className="text-sm">
      <div className="text-xs opacity-50 mb-2">{data.city}</div>
      <div className="flex items-baseline gap-3 mb-3">
        <Icon className="w-8 h-8 -translate-y-1" />
        <div className="text-5xl font-thin tabular-nums">{data.temp}°</div>
      </div>
      <div className="opacity-70 text-xs mb-3">{data.desc} · feels {data.feels}°</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5 opacity-70">
          <Droplets className="w-3 h-3" /> {data.humidity}%
        </div>
        <div className="flex items-center gap-1.5 opacity-70">
          <Wind className="w-3 h-3" /> {data.wind} km/h
        </div>
        <div className="flex items-center gap-1.5 opacity-70">
          <Eye className="w-3 h-3" /> {data.visibility} km
        </div>
        <div className="flex items-center gap-1.5 opacity-70">
          <Gauge className="w-3 h-3" /> {data.pressure} hPa
        </div>
      </div>
    </div>
  );
}