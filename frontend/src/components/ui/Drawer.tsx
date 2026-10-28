import React, { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './IconButton';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg';
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
}: DrawerProps) {
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
    md: 'w-full md:w-[480px]',
    lg: 'w-full md:w-[560px]',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Scrim Overlay */}
      <div
        className="fixed inset-0 bg-overlay-scrim transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        className={cn(
          'relative h-full outline-none bg-surface-default text-text-primary border-l border-border-default shadow-elevation-3 flex flex-col z-10 transition-transform duration-250 ease-out',
          widthClasses[width]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border-subtle">
          <div className="space-y-1 pr-6">
            <h2 id={titleId} className="text-xl leading-7 font-semibold tracking-[-0.005em] text-text-primary">
              {title}
            </h2>
            {subtitle && (
              <p id={descId} className="text-[13px] leading-[18px] text-text-secondary">
                {subtitle}
              </p>
            )}
          </div>
          <IconButton
            icon="x"
            label="Close drawer"
            size="touch"
            variant="ghost"
            data-modal-close
            onClick={onClose}
            className="-mr-2 -mt-2"
          />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">{children}</div>

        {/* Footer actions */}
        {footer && (
          <div className="p-4 px-6 border-t border-border-subtle bg-surface-subtle flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
