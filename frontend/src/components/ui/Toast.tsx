'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon, IconName } from './Icon';

/*
 * Figma `Toast` (Tone Info | Success | Warning | Error). surface/raised, border/default, radius lg, ds/Elevation/2.
 * Bottom-right on desktop, above the 64 px tab bar on mobile. Auto-dismiss except Error.
 */

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

const TONES: Record<ToastTone, { icon: IconName; fg: string }> = {
  info: { icon: 'info', fg: 'text-status-info-fg' },
  success: { icon: 'check-circle', fg: 'text-status-success-fg' },
  warning: { icon: 'alert-triangle', fg: 'text-status-warning-fg' },
  error: { icon: 'alert-circle', fg: 'text-status-danger-fg' },
};

export interface ToastProps {
  tone?: ToastTone;
  title: string;
  body?: string;
  onClose?: () => void;
  className?: string;
}

/** Presentational toast (use `useToast().show()` for the managed stack). */
export function Toast({ tone = 'info', title, body, onClose, className }: ToastProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'w-full sm:w-[360px] flex items-start gap-3 py-3 pl-4 pr-2 rounded-lg border border-border-default bg-surface-raised shadow-elevation-2',
        className
      )}
    >
      <Icon name={t.icon} size={20} className={cn('shrink-0 mt-0.5', t.fg)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-5 text-text-primary">{title}</p>
        {body && <p className="text-[13px] leading-[18px] text-text-secondary mt-0.5">{body}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="shrink-0 -my-1 w-11 h-11 inline-flex items-center justify-center rounded-md text-icon-muted hover:text-icon-strong hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

interface ToastItem extends Omit<ToastProps, 'onClose' | 'className'> {
  id: number;
}

interface ToastContextValue {
  show: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { ...toast, id }]);
      if (toast.tone !== 'error') {
        timers.current.set(id, setTimeout(() => dismiss(id), AUTO_DISMISS_MS));
      }
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[60] right-4 left-4 sm:left-auto bottom-20 md:bottom-6 md:right-6 flex flex-col gap-2 items-end pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full sm:w-auto">
            <Toast tone={t.tone} title={t.title} body={t.body} onClose={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
