// Theme presets. Each theme defines the body background, foreground
// color, and the gradient (if any) used for the body's
// backgroundImage. Adding a new theme is just a new entry here —
// nothing else in the app cares about the concrete theme id, only
// `ThemeName`.

export type ThemeName =
  | 'dark'
  | 'light'
  | 'claude'
  | 'sunset'
  | 'forest'
  | 'ocean'
  | 'paper';

export type ThemePalette = {
  /** Tailwind class for body bg + text. Use 'bg-X text-Y'. */
  bodyClass: string;
  /** Optional inline backgroundColor (overrides bodyClass for bg). */
  bgColor?: string;
  /** Optional inline backgroundImage (overrides bodyClass for bg). */
  bgImage?: string;
  /** Transition style for the background swap. */
  bgTransition: string;
  /** Radial vignette color over the wallpaper. */
  vignette: string;
  /** Default tint for the contrast hint / chip backgrounds. */
  isDark: boolean;
  /**
   * Color tokens used throughout the UI for chips, borders, and
   * text overrides. Names follow the existing convention in
   * App.tsx so the rest of the app can keep its ternaries without
   * a per-theme fork.
   *
   * - `text`         — primary foreground
   * - `textMuted`    — secondary foreground (60% alpha)
   * - `textFaint`    — tertiary foreground (40% alpha)
   * - `border`       — 15% border for separators
   * - `borderHover`  — 30% border on hover
   * - `surface`      — chip background (10% alpha)
   * - `surfaceHover` — chip hover background (20% alpha)
   */
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderHover: string;
  surface: string;
  surfaceHover: string;
  /** Human-readable label key suffix (settings.theme.<id>). */
  label: string;
};

export const THEMES: Record<ThemeName, ThemePalette> = {
  dark: {
    bodyClass: 'bg-black text-white',
    bgTransition: 'background-color 700ms ease',
    vignette: 'radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 60%)',
    isDark: true,
    text: 'text-white',
    textMuted: 'text-white/60',
    textFaint: 'text-white/40',
    border: 'border-white/15',
    borderHover: 'border-white/30',
    surface: 'bg-white/10',
    surfaceHover: 'hover:bg-white/20',
    label: 'Dark',
  },
  light: {
    bodyClass: 'bg-white text-black',
    bgTransition: 'background-color 700ms ease',
    vignette: 'radial-gradient(ellipse at center, rgba(0,0,0,0.03) 0%, transparent 60%)',
    isDark: false,
    text: 'text-black',
    textMuted: 'text-black/60',
    textFaint: 'text-black/40',
    border: 'border-black/15',
    borderHover: 'border-black/30',
    surface: 'bg-black/10',
    surfaceHover: 'hover:bg-black/20',
    label: 'Light',
  },
  claude: {
    bodyClass: 'text-[#3a2e1f]',
    bgColor: '#faf6ef',
    bgImage:
      'radial-gradient(at 20% 0%, rgba(217, 119, 87, 0.08) 0px, transparent 50%), radial-gradient(at 80% 100%, rgba(255, 184, 140, 0.10) 0px, transparent 50%)',
    bgTransition: 'background-color 700ms ease, background-image 700ms ease',
    vignette: 'radial-gradient(ellipse at center, rgba(120, 80, 40, 0.04) 0%, transparent 60%)',
    isDark: false,
    text: 'text-[#3a2e1f]',
    textMuted: 'text-[#3a2e1f]/60',
    textFaint: 'text-[#3a2e1f]/40',
    border: 'border-[#3a2e1f]/15',
    borderHover: 'border-[#3a2e1f]/30',
    surface: 'bg-[#3a2e1f]/10',
    surfaceHover: 'hover:bg-[#3a2e1f]/20',
    label: 'Claude',
  },
  // Sunset — warm dark amber, like dusk. Pairs well with retro/flip.
  sunset: {
    bodyClass: 'text-[#fff4e6]',
    bgColor: '#1f0e0a',
    bgImage:
      'radial-gradient(at 10% 0%, rgba(255, 140, 50, 0.18) 0px, transparent 50%), radial-gradient(at 90% 100%, rgba(220, 60, 80, 0.12) 0px, transparent 50%)',
    bgTransition: 'background-color 700ms ease, background-image 700ms ease',
    vignette: 'radial-gradient(ellipse at center, rgba(255, 200, 120, 0.04) 0%, transparent 60%)',
    isDark: true,
    text: 'text-[#fff4e6]',
    textMuted: 'text-[#fff4e6]/60',
    textFaint: 'text-[#fff4e6]/40',
    border: 'border-[#fff4e6]/15',
    borderHover: 'border-[#fff4e6]/30',
    surface: 'bg-[#fff4e6]/10',
    surfaceHover: 'hover:bg-[#fff4e6]/20',
    label: 'Sunset',
  },
  // Forest — deep teal/green dark, gentle and low-strain.
  forest: {
    bodyClass: 'text-[#d8f0e0]',
    bgColor: '#0a1f17',
    bgImage:
      'radial-gradient(at 0% 0%, rgba(40, 160, 100, 0.15) 0px, transparent 55%), radial-gradient(at 100% 100%, rgba(80, 130, 90, 0.10) 0px, transparent 55%)',
    bgTransition: 'background-color 700ms ease, background-image 700ms ease',
    vignette: 'radial-gradient(ellipse at center, rgba(120, 200, 140, 0.04) 0%, transparent 60%)',
    isDark: true,
    text: 'text-[#d8f0e0]',
    textMuted: 'text-[#d8f0e0]/60',
    textFaint: 'text-[#d8f0e0]/40',
    border: 'border-[#d8f0e0]/15',
    borderHover: 'border-[#d8f0e0]/30',
    surface: 'bg-[#d8f0e0]/10',
    surfaceHover: 'hover:bg-[#d8f0e0]/20',
    label: 'Forest',
  },
  // Ocean — deep midnight blue with cyan accents.
  ocean: {
    bodyClass: 'text-[#dff1ff]',
    bgColor: '#0a1428',
    bgImage:
      'radial-gradient(at 100% 0%, rgba(40, 140, 220, 0.16) 0px, transparent 55%), radial-gradient(at 0% 100%, rgba(60, 100, 200, 0.10) 0px, transparent 55%)',
    bgTransition: 'background-color 700ms ease, background-image 700ms ease',
    vignette: 'radial-gradient(ellipse at center, rgba(100, 180, 240, 0.04) 0%, transparent 60%)',
    isDark: true,
    text: 'text-[#dff1ff]',
    textMuted: 'text-[#dff1ff]/60',
    textFaint: 'text-[#dff1ff]/40',
    border: 'border-[#dff1ff]/15',
    borderHover: 'border-[#dff1ff]/30',
    surface: 'bg-[#dff1ff]/10',
    surfaceHover: 'hover:bg-[#dff1ff]/20',
    label: 'Ocean',
  },
  // Paper — warm off-white, like a reading app. Calm and daylight.
  paper: {
    bodyClass: 'text-[#2b2418]',
    bgColor: '#f5efe1',
    bgImage:
      'radial-gradient(at 20% 0%, rgba(200, 170, 120, 0.12) 0px, transparent 55%), radial-gradient(at 80% 100%, rgba(160, 140, 100, 0.08) 0px, transparent 55%)',
    bgTransition: 'background-color 700ms ease, background-image 700ms ease',
    vignette: 'radial-gradient(ellipse at center, rgba(80, 60, 30, 0.04) 0%, transparent 60%)',
    isDark: false,
    text: 'text-[#2b2418]',
    textMuted: 'text-[#2b2418]/60',
    textFaint: 'text-[#2b2418]/40',
    border: 'border-[#2b2418]/15',
    borderHover: 'border-[#2b2418]/30',
    surface: 'bg-[#2b2418]/10',
    surfaceHover: 'hover:bg-[#2b2418]/20',
    label: 'Paper',
  },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];