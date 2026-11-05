import React, { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, panelRef);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-[400px]',
    md: 'max-w-[520px]',
    lg: 'max-w-[720px]',
    xl: 'max-w-[900px]',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim Overlay */}
      <div
        className="fixed inset-0 bg-overlay-scrim transition-opacity"
        onClick={onClose}
      />

      {/* Dialog Window */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative w-full outline-none rounded-xl border border-border-default bg-surface-default text-text-primary shadow-elevation-3 transition-all z-10 overflow-hidden',
          widthClasses[maxWidth]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border-subtle">
          <div className="space-y-1 pr-6">
            <h2 id={titleId} className="text-xl leading-7 font-semibold tracking-[-0.005em] text-text-primary">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-[13px] leading-[18px] text-text-secondary">
                {description}
              </p>
            )}
          </div>
          <IconButton
            icon="x"
            label="Close dialog"
            size="touch"
            variant="ghost"
            data-modal-close
            onClick={onClose}
            className="-mr-2 -mt-2"
          />
        </div>

        {/* Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-4 px-6 border-t border-border-subtle bg-surface-subtle">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
