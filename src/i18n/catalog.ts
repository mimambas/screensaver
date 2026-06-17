// Translation catalog: every user-visible string in the app lives
// here. Adding a new key without both locales is a TypeScript error.
//
// Key naming convention: `<namespace>.<purpose>`.
//   - common.cancel, common.save
//   - settings.section.wallpaper, settings.theme
//   - pomodoro.mode.work, pomodoro.achievement.streak
//
// Keep emoji out of the catalog (they're universal). Keep keyboard
// shortcut letters out too (F/S/H are universal). Numbers and dates
// are formatted via the host locale at use-site, not via i18n.

export type Locale = 'en' | 'id';

export type Catalog = Record<string, { en: string; id: string }>;

export const catalog: Catalog = {
  // ── common ─────────────────────────────────────────────────────
  'common.cancel': { en: 'Cancel', id: 'Batal' },
  'common.reset': { en: 'Reset', id: 'Reset' },
  'common.save': { en: 'Save', id: 'Simpan' },
  'common.close': { en: 'Close', id: 'Tutup' },
  'common.delete': { en: 'Delete', id: 'Hapus' },
  'common.add': { en: 'Add', id: 'Tambah' },
  'common.loading': { en: 'Loading…', id: 'Memuat…' },
  'common.retry': { en: 'Retry', id: 'Coba lagi' },
  'common.optional': { en: 'optional', id: 'opsional' },

  // ── settings dialog ────────────────────────────────────────────
  'settings.title': { en: 'Settings', id: 'Pengaturan' },
  'clock.decrease': { en: 'Decrease clock size', id: 'Kurangi ukuran jam' },
  'clock.increase': { en: 'Increase clock size', id: 'Tambah ukuran jam' },
  'settings.section.layout': { en: 'Layout', id: 'Tata Letak' },
  'settings.section.theme': { en: 'Theme', id: 'Tema' },
  'settings.section.wallpaper': { en: 'Wallpaper', id: 'Latar Belakang' },
  'settings.section.ambient': { en: 'Ambient Sound', id: 'Suara Ambient' },
  'settings.section.clockStyle': { en: 'Clock Style', id: 'Gaya Jam' },
  'settings.section.clockSize': { en: 'Clock Size', id: 'Ukuran Jam' },
  'settings.section.clockColor': { en: 'Clock Color', id: 'Warna Jam' },
  'settings.section.weatherCity': { en: 'Weather City', id: 'Kota Cuaca' },
  'settings.section.widgets': { en: 'Widgets', id: 'Widget' },
  'settings.section.cities': { en: 'Cities ({n})', id: 'Kota ({n})' },
  'settings.section.backup': { en: 'Backup', id: 'Cadangan' },
  'settings.section.shortcuts': { en: 'Shortcuts:', id: 'Pintasan:' },
  'settings.section.language': { en: 'Language', id: 'Bahasa' },
  'settings.theme.auto': { en: 'Auto theme by hour', id: 'Tema otomatis per jam' },
  'settings.theme.dark': { en: '🌑 Dark', id: '🌑 Gelap' },
  'settings.theme.light': { en: '☀️ Light', id: '☀️ Terang' },
  'settings.theme.claude': { en: '🍂 Claude', id: '🍂 Claude' },
  'settings.fullscreen.after': { en: 'Fullscreen after', id: 'Layar penuh setelah' },
  'settings.fullscreen.minIdle': { en: 'min idle', id: 'menit idle' },
  'settings.wallpaper.intensity': { en: 'Intensity', id: 'Intensitas' },
  'settings.ambient.volume': { en: 'Volume', id: 'Volume' },
  'settings.weather.placeholder': {
    en: 'Jakarta, Tokyo, London…',
    id: 'Jakarta, Tokyo, London…',
  },
  'settings.weather.visibility': { en: 'Visibility', id: 'Visibilitas' },
  'settings.cities.hint': {
    en: 'Enter an IANA timezone (e.g. ',
    id: 'Masukkan zona waktu IANA (mis. ',
  },
  'settings.cities.reset': { en: 'Reset to defaults', id: 'Reset ke default' },
  'settings.backup.export': { en: 'Export', id: 'Ekspor' },
  'settings.backup.import': { en: 'Import', id: 'Impor' },
  'settings.language.en': { en: 'English', id: 'Inggris' },
  'settings.language.id': { en: 'Indonesian', id: 'Indonesia' },

  // ── shortcuts hint pill (bottom-center) ───────────────────────
  'shortcuts.hint.fullscreen': { en: 'fullscreen', id: 'layar penuh' },
  'shortcuts.hint.settings': { en: 'settings', id: 'pengaturan' },
  'shortcuts.hint.hideUI': { en: 'hide UI', id: 'sembunyikan UI' },
  'shortcuts.hint.closeWake': { en: 'close / wake', id: 'tutup / bangunkan' },
  'shortcuts.hint.closeWakeShort': { en: 'close/wake', id: 'tutup/bangunkan' },

  // ── controls (top-right buttons) ──────────────────────────────
  'control.fullscreen': { en: 'Fullscreen (F)', id: 'Layar penuh (F)' },
  'control.fullscreenPwa': {
    en: 'Already fullscreen (PWA)',
    id: 'Sudah layar penuh (PWA)',
  },
  'control.toggleFullscreen': { en: 'Toggle fullscreen', id: 'Beralih layar penuh' },
  'control.settings': { en: 'Settings (S)', id: 'Pengaturan (S)' },
  'control.toggleSettings': { en: 'Toggle settings', id: 'Beralih pengaturan' },

  // ── pomodoro widget ───────────────────────────────────────────
  'pomodoro.mode.work': { en: 'Focus', id: 'Fokus' },
  'pomodoro.mode.short': { en: 'Short Break', id: 'Istirahat Pendek' },
  'pomodoro.mode.long': { en: 'Long Break', id: 'Istirahat Panjang' },
  'pomodoro.mode.workShort': { en: 'work', id: 'fokus' },
  'pomodoro.mode.shortShort': { en: 'break', id: 'istirahat' },
  'pomodoro.mode.longShort': { en: 'long', id: 'panjang' },
  'pomodoro.cycleOf': { en: 'cycle {n}', id: 'siklus {n}' },
  'pomodoro.decrease': { en: 'Decrease duration', id: 'Kurangi durasi' },
  'pomodoro.increase': { en: 'Increase duration', id: 'Tambah durasi' },
  'pomodoro.pause': { en: 'Pause', id: 'Jeda' },
  'pomodoro.start': { en: 'Start', id: 'Mulai' },
  'pomodoro.skip': { en: 'Skip phase', id: 'Lewati fase' },
  'pomodoro.skipTitle': { en: 'Skip to next phase', id: 'Lewati ke fase berikutnya' },
  'pomodoro.autoStart': { en: 'auto-start next', id: 'mulai otomatis berikutnya' },
  'pomodoro.statsToggle': { en: 'stats', id: 'statistik' },
  'pomodoro.statsSummary': {
    en: '{total}m this week · {streak}d streak',
    id: '{total}m minggu ini · {streak} hari berturut',
  },
  'pomodoro.heatmapToggle': { en: 'heatmap', id: 'peta panas' },
  'pomodoro.heatmapSummary': {
    en: '{h}h focused',
    id: '{h} jam fokus',
  },
  'pomodoro.heatmapHint': {
    en: 'opacity ∝ minutes · today has ring',
    id: 'opacity sebanding dengan menit · hari ini di-ring',
  },
  'pomodoro.heatmapLegend.work': { en: 'work', id: 'fokus' },
  'pomodoro.heatmapLegend.short': { en: 'short break', id: 'istirahat pendek' },
  'pomodoro.heatmapLegend.long': { en: 'long break', id: 'istirahat panjang' },
  'pomodoro.cyclesCompleted': {
    en: '{n} focus sessions completed',
    id: '{n} sesi fokus selesai',
  },
  'pomodoro.aria.lastNDays': {
    en: 'Last {n} days of focus time',
    id: '{n} hari terakhir waktu fokus',
  },
  'pomodoro.aria.range': { en: 'Range', id: 'Rentang' },
  'pomodoro.aria.heatmap': {
    en: '7 days × 24 hours focus heatmap',
    id: 'peta panas fokus 7 hari × 24 jam',
  },
  'pomodoro.headline7d': {
    en: '{total} min · {days}d focused · best {best}m',
    id: '{total} mnt · {days} hari fokus · terbaik {best}m',
  },
  'pomodoro.headline30d': {
    en: '{total} min · best {best}m',
    id: '{total} mnt · terbaik {best}m',
  },
  'pomodoro.achievement.streak': {
    en: '🔥 {n}d streak',
    id: '🔥 {n} hari berturut',
  },
  'pomodoro.achievement.bestStreak': {
    en: '🏆 best {n}d',
    id: '🏆 terbaik {n} hari',
  },
  'pomodoro.achievement.bestDay': {
    en: '⭐ best day {n}m',
    id: '⭐ hari terbaik {n}m',
  },
  'pomodoro.achievement.cyclesToday': {
    en: '📅 {n} cycles today',
    id: '📅 {n} siklus hari ini',
  },
  'pomodoro.achievement.10hWeek': {
    en: '💪 10h this week',
    id: '💪 10 jam minggu ini',
  },
  'pomodoro.cell.title': {
    en: '{m}m · {c} cycle',
    id: '{m}m · {c} siklus',
  },
  'pomodoro.reset.confirm': {
    en: 'Are you sure? This will clear all stats.',
    id: 'Yakin? Ini akan menghapus semua statistik.',
  },

  // ── world clock city picker ───────────────────────────────────
  'cities.addPlaceholder': {
    en: 'Add city (e.g. Asia/Singapore)',
    id: 'Tambah kota (mis. Asia/Singapore)',
  },
  'cities.addAria': { en: 'Add city', id: 'Tambah kota' },
  'cities.removeAria': { en: 'Remove {tz}', id: 'Hapus {tz}' },
  'cities.renameAria': { en: 'Rename {tz}', id: 'Ganti nama {tz}' },

  // ── weather widget ────────────────────────────────────────────
  'weather.loading': { en: 'Loading weather for {city}…', id: 'Memuat cuaca untuk {city}…' },
  'weather.retry': { en: 'Retry weather', id: 'Coba lagi cuaca' },

  // ── stopwatch / timer ─────────────────────────────────────────
  'stopwatch.start': { en: 'Start', id: 'Mulai' },
  'stopwatch.pause': { en: 'Pause', id: 'Jeda' },
  'stopwatch.reset': { en: 'Reset', id: 'Reset' },
  'stopwatch.recordLap': { en: 'Record lap', id: 'Catat lap' },
  'timer.start': { en: 'Start timer', id: 'Mulai timer' },
  'timer.pause': { en: 'Pause timer', id: 'Jeda timer' },
  'timer.reset': { en: 'Reset timer', id: 'Reset timer' },

  // ── calendar ──────────────────────────────────────────────────
  'calendar.prevMonth': { en: 'Previous month', id: 'Bulan sebelumnya' },
  'calendar.nextMonth': { en: 'Next month', id: 'Bulan berikutnya' },

  // ── alarms ────────────────────────────────────────────────────
  'alarm.add': { en: 'Add alarm', id: 'Tambah alarm' },
  'alarm.disable': { en: 'Disable alarm', id: 'Nonaktifkan alarm' },
  'alarm.enable': { en: 'Enable alarm', id: 'Aktifkan alarm' },
  'alarm.delete': { en: 'Delete alarm', id: 'Hapus alarm' },
  'alarm.snooze': { en: 'Snooze 5 minutes', id: 'Tunda 5 menit' },
  'alarm.label': { en: 'Label ({opt})', id: 'Label ({opt})' },
  'alarm.dow.sun': { en: 'Sun', id: 'Min' },
  'alarm.dow.mon': { en: 'Mon', id: 'Sen' },
  'alarm.dow.tue': { en: 'Tue', id: 'Sel' },
  'alarm.dow.wed': { en: 'Wed', id: 'Rab' },
  'alarm.dow.thu': { en: 'Thu', id: 'Kam' },
  'alarm.dow.fri': { en: 'Fri', id: 'Jum' },
  'alarm.dow.sat': { en: 'Sat', id: 'Sab' },
  'alarm.dow.sunLong': { en: 'Sunday', id: 'Minggu' },
  'alarm.dow.monLong': { en: 'Monday', id: 'Senin' },
  'alarm.dow.tueLong': { en: 'Tuesday', id: 'Selasa' },
  'alarm.dow.wedLong': { en: 'Wednesday', id: 'Rabu' },
  'alarm.dow.thuLong': { en: 'Thursday', id: 'Kamis' },
  'alarm.dow.friLong': { en: 'Friday', id: 'Jumat' },
  'alarm.dow.satLong': { en: 'Saturday', id: 'Sabtu' },

  // ── sleep timer overlay ──────────────────────────────────────
  'sleep.tapToWake': { en: 'Tap to wake', id: 'Sentuh untuk bangunkan' },
  'sleep.tapAnywhereToWake': {
    en: 'Tap anywhere to wake',
    id: 'Sentuh di mana saja untuk bangunkan',
  },

  // ── draggable widget ─────────────────────────────────────────
  'draggable.handleTitle': {
    en: 'Drag to move, double-click to reset',
    id: 'Tarik untuk pindah, klik dua kali untuk reset',
  },
  'draggable.resetTitle': { en: 'Reset position', id: 'Reset posisi' },
};
