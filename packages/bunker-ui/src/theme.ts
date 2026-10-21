export type Theme = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bunkercoin.theme';
export const THEME_COLORS = { light: '#ffffff', dark: '#090909' } as const;

const isTheme = (v: unknown): v is Theme => v === 'system' || v === 'light' || v === 'dark';

/** Inline in <head> before paint so the stored choice applies without a flash. */
export function themeInitScript(fallback: Theme): string {
  return `(function(){var t=${JSON.stringify(fallback)};try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(s==='system'||s==='light'||s==='dark')t=s}catch(e){}var r=document.documentElement;if(t==='system')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t)})()`;
}

export function readTheme(fallback: Theme): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}
