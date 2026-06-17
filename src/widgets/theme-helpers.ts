// Theme helpers — shared by App.tsx + SettingsPanel + Layouts.
// Kept tiny so circular-import risk is low.

import { THEMES, type ThemeName } from './theme-presets';

export const isDark = (t: ThemeName): boolean => THEMES[t].isDark;
export const isClaude = (t: ThemeName): boolean => t === 'claude';
