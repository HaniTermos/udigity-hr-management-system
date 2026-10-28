'use client';

import React, { useEffect, useState } from 'react';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Icon button: flips between light and navy dark (persists; overrides system). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mount flag avoids a hydration mismatch on the theme icon.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const label = mounted && theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      suppressHydrationWarning
      className={cn(
        'p-2 rounded-lg transition-colors hover:bg-surface-hover text-icon-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center',
        className
      )}
    >
      {mounted ? (
        theme === 'dark' ? <Sun className="w-5 h-5" aria-hidden /> : <Moon className="w-5 h-5" aria-hidden />
      ) : (
        <span className="w-5 h-5" />
      )}
    </button>
  );
}

const OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

/** Segmented Light / Dark / System control (Profile → Appearance). */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { preference, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        'inline-flex items-center p-1 rounded-lg bg-surface-sunken border border-border-subtle text-sm font-medium select-none',
        className
      )}
    >
      {OPTIONS.map((o) => {
        const active = preference === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(o.id)}
            suppressHydrationWarning
            className={cn(
              'px-3 h-8 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              active
                ? 'bg-surface-default text-text-primary shadow-elevation-1 font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
