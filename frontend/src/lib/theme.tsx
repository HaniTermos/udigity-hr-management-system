'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/** Resolved theme actually applied to <html>. */
export type Theme = 'light' | 'dark';
/** User preference. `system` follows `prefers-color-scheme` live. */
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'udigity-theme';

interface ThemeContextType {
  /** Resolved theme ('light' | 'dark'). */
  theme: Theme;
  /** Stored preference ('light' | 'dark' | 'system'). */
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Runs during HTML parsing (before first paint) so there is no light→navy flash.
 * Pattern from node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p!=="light")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}})()`;

/** Inline script; `text/plain` on the client so React does not warn and it never re-runs. */
export function ThemeScript({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  );
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // Server render is always 'light'/'system'; the inline script has already set the DOM class.
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [theme, setResolved] = useState<Theme>('light');

  useEffect(() => {
    // Hydration-safe sync from storage after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    const pref = readPreference();
    setPreference(pref);
    setResolved(pref === 'system' ? systemTheme() : pref);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Follow OS changes while the preference is 'system'.
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: Theme = mq.matches ? 'dark' : 'light';
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    const resolved = next === 'system' ? systemTheme() : next;
    setPreference(next);
    setResolved(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme }}>
      <ThemeScript nonce={nonce} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
