export type ClockStyle = 'digital' | 'analog' | 'retro' | 'flip' | 'casio';
export type ClockColor =
  | 'white'
  | 'ink'
  | 'amber'
  | 'green'
  | 'cyan'
  | 'red'
  | 'pink'
  | 'mint'
  | 'lavender'
  | 'peach'
  | 'gold';
/** Continuous scale multiplier, 0.5 .. 3.0, step 0.1 */
export type ClockSize = number;
export type ThemeName = 'dark' | 'light' | 'claude';

export const CLOCK_STYLES: ClockStyle[] = ['digital', 'analog', 'retro', 'flip', 'casio'];
/** Preset sizes for the +/- button quick-select. */
export const CLOCK_SIZE_PRESETS = {
  min: 0.5,
  max: 3.0,
  step: 0.1,
  default: 1.0,
} as const;
export const CLOCK_SIZES: { id: ClockSize; label: string; scale: number }[] = [
  { id: 0.7, label: 'Small', scale: 0.7 },
  { id: 1.0, label: 'Medium', scale: 1 },
  { id: 1.3, label: 'Large', scale: 1.3 },
  { id: 1.7, label: 'X-Large', scale: 1.7 },
];
export const CLOCK_COLORS: { id: ClockColor; label: string; hex: string }[] = [
  { id: 'white', label: 'White', hex: '#ffffff' },
  { id: 'ink', label: 'Ink', hex: '#0a0a0a' },
  { id: 'amber', label: 'Amber', hex: '#ffb000' },
  { id: 'green', label: 'Green', hex: '#33ff66' },
  { id: 'cyan', label: 'Cyan', hex: '#00e5ff' },
  { id: 'red', label: 'Red', hex: '#ff3344' },
  { id: 'pink', label: 'Pink', hex: '#ff66cc' },
  { id: 'mint', label: 'Mint', hex: '#5eead4' },
  { id: 'lavender', label: 'Lavender', hex: '#c4b5fd' },
  { id: 'peach', label: 'Peach', hex: '#fdba74' },
  { id: 'gold', label: 'Gold', hex: '#fde047' },
];

export function getColor(color: ClockColor): string {
  return CLOCK_COLORS.find((x) => x.id === color)?.hex ?? '#ffffff';
}

export function getSizeScale(size: ClockSize | undefined): number {
  return typeof size === 'number' && Number.isFinite(size) ? size : 1;
}

export function clampClockSize(size: ClockSize): ClockSize {
  const { min, max } = CLOCK_SIZE_PRESETS;
  const n = typeof size === 'number' && Number.isFinite(size) ? size : 1;
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}

// Theme no longer affects color choice — user picks whatever they want.
// (UI shows a contrast hint for likely-invisible combinations.)
export function effectiveClockColor(color: ClockColor): ClockColor {
  return color;
}

// Clocks with their own dark panel (Retro, Flip) can't show 'ink' digits —
// they blend into the card background. Fallback to white for any caller
// that wraps a dark surface.
export function safeDarkBgColor(color: ClockColor): ClockColor {
  return color === 'ink' ? 'white' : color;
}

export const DEFAULT_CITIES: { name: string; tz: string }[] = [
  { name: 'NYC', tz: 'America/New_York' },
  { name: 'LDN', tz: 'Europe/London' },
  { name: 'TYO', tz: 'Asia/Tokyo' },
  { name: 'JAK', tz: 'Asia/Jakarta' },
  { name: 'SYD', tz: 'Australia/Sydney' },
];
