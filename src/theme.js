// Color tokens shared by every page Drop renders (admin, login, listings, and
// generated markdown). Pages follow the OS light/dark setting unless
// <html data-theme="light|dark"> overrides it.

const LIGHT = {
  bg: '#fafafa', surface: '#ffffff', 'surface-2': '#f4f4f5',
  border: '#e4e4e7', 'border-strong': '#d4d4d8',
  text: '#18181b', muted: '#52525b', faint: '#a1a1aa',
  accent: '#2563eb', 'accent-text': '#ffffff', 'accent-soft': '#eff6ff',
  danger: '#dc2626', 'danger-soft': '#fef2f2', ok: '#16a34a',
};

const DARK = {
  bg: '#0b0b0c', surface: '#141416', 'surface-2': '#1c1c1f',
  border: '#27272a', 'border-strong': '#3f3f46',
  text: '#f4f4f5', muted: '#a1a1aa', faint: '#71717a',
  accent: '#60a5fa', 'accent-text': '#0b0b0c', 'accent-soft': 'rgba(96, 165, 250, 0.12)',
  danger: '#f87171', 'danger-soft': 'rgba(248, 113, 113, 0.12)', ok: '#4ade80',
};

export const FONT_SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FONT_SERIF = "Charter, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
export const FONT_MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace";

function tokens(values) {
  return Object.entries(values).map(([name, value]) => `--${name}: ${value};`).join(' ');
}

export function paletteCss() {
  return `
:root { color-scheme: light; ${tokens(LIGHT)} }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { color-scheme: dark; ${tokens(DARK)} }
}
:root[data-theme="dark"] { color-scheme: dark; ${tokens(DARK)} }`;
}
