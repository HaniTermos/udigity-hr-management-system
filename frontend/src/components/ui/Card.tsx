import React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { NoticePolicy } from './NoticePolicy';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-default bg-surface-default text-text-primary transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold leading-6 text-text-primary', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-[13px] leading-[18px] text-text-secondary', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center p-5 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardMetricProps {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat' | 'pending' | 'loading';
  caption?: string;
  className?: string;
}

export function CardMetric({
  label,
  value,
  delta,
  trend = 'flat',
  caption,
  className,
}: CardMetricProps) {
  return (
    <Card className={cn('p-4 flex flex-col justify-between', className)}>
      <div className="text-[13px] leading-[18px] font-medium text-text-secondary">
        {label}
      </div>

      <div className="my-2 flex items-baseline justify-between">
        {trend === 'loading' ? (
          <span className="h-9 w-20 rounded-md bg-surface-skeleton animate-pulse" aria-label="Loading" />
        ) : (
          <span className="ds-number-lg text-text-primary">{trend === 'pending' ? '—' : value}</span>
        )}
        {trend === 'pending' && (
          <NoticePolicy size="chip" tone="policy" dec="DEC-020" />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border-subtle">
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              trend === 'up' && 'text-status-success-fg',
              trend === 'down' && 'text-status-danger-fg',
              trend === 'flat' && 'text-text-muted'
            )}
          >
            {trend === 'up' && <Icon name="trend-up" size={12} />}
            {trend === 'down' && <Icon name="trend-down" size={12} />}
            {trend === 'flat' && <span className="inline-block w-2 h-0.5 bg-current mr-1" />}
            {delta}
          </span>
        )}
        {caption && <span className="truncate ml-auto">{caption}</span>}
      </div>
    </Card>
  );
}

/** Figma `Card/Section`: header (Title, Subtitle, Action) + content slot. Padding 20. */
export function CardSection({
  title,
  subtitle,
  action,
  className,
  children,
  as: Heading = 'h2',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <Card className={cn('p-5 flex flex-col gap-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="text-base font-semibold leading-6 text-text-primary">{title}</Heading>
          {subtitle && <p className="text-[13px] leading-[18px] text-text-muted mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 text-[13px] font-medium">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

/** Figma `Card/Inset`: nested area on surface/subtle. */
export function CardInset({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg border border-border-subtle bg-surface-subtle p-4', className)} {...props}>
      {children}
    </div>
  );
}
