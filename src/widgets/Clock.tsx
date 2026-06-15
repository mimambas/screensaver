import { useEffect, useState } from 'react';

export function DigitalClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return (
    <div className="font-mono">
      <div className="text-9xl font-thin tracking-tighter tabular-nums">
        {hh}<span className="opacity-30">:</span>{mm}<span className="opacity-30 text-3xl align-top ml-2">{ss}</span>
      </div>
    </div>
  );
}

export function WorldClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cities = [
    { name: 'NYC', tz: 'America/New_York' },
    { name: 'LDN', tz: 'Europe/London' },
    { name: 'TYO', tz: 'Asia/Tokyo' },
    { name: 'JAK', tz: 'Asia/Jakarta' },
    { name: 'SYD', tz: 'Australia/Sydney' },
  ];

  const format = (tz: string) => {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      hour12: false,
    }).format(now);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
      {cities.map((c) => (
        <div key={c.name} className="text-center">
          <div className="text-xs opacity-50 mb-1">{c.name}</div>
          <div className="text-2xl tabular-nums tracking-tight">{format(c.tz)}</div>
        </div>
      ))}
    </div>
  );
}

export function DateDisplay() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="text-center">
      <div className="text-2xl font-light tracking-wide">{dayName}</div>
      <div className="text-sm opacity-60 mt-1">{dateStr}</div>
    </div>
  );
}