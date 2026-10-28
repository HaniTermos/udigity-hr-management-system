import React from 'react';
import { cn } from '@/lib/utils';
import { Icon, IconName } from './Icon';

/*
 * Figma fields: `Input` (45:796), `Textarea` (45:847), `Select` (46:434), `Input/Date` (46:594), `Input/Search` (46:748).
 * All are width-agnostic (12e). Focus/Open = 2px focus-ring stroke inside the control (12d).
 * Error = danger border + alert icon + message row (always shown in Error state).
 */

const CONTROL =
  'w-full rounded-md text-sm leading-5 transition-colors bg-surface-default text-text-primary placeholder:text-text-placeholder ' +
  'border border-border-input hover:border-text-secondary focus:outline-none focus-ring-inside ' +
  'disabled:bg-surface-disabled disabled:text-text-disabled disabled:border-border-default disabled:cursor-not-allowed';

const CONTROL_ERROR = 'border-status-danger-solid shadow-[inset_0_0_0_1px_var(--status-danger-solid)]';

export interface FieldShellProps {
  id: string;
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  /** Right side of the label row, e.g. a policy-pending chip or counter. */
  labelAside?: React.ReactNode;
  counter?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label row + control + helper/error row. Use to wrap custom controls so they match the DS. */
export function FieldShell({ id, label, required, helperText, error, labelAside, counter, className, children }: FieldShellProps) {
  return (
    <div className={cn('w-full min-w-0 flex flex-col gap-1.5 text-left', className)}>
      {(label || labelAside) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-sm font-medium leading-5 text-text-primary select-none flex items-center gap-1">
              <span>{label}</span>
              {required && (
                <span aria-hidden className="text-status-danger-fg">
                  *
                </span>
              )}
            </label>
          )}
          {labelAside}
        </div>
      )}
      {children}
      {(error || helperText || counter) && (
        <div className="flex items-start justify-between gap-2">
          {error ? (
            <p id={`${id}-error`} className="flex items-start gap-1.5 text-[13px] leading-[18px] text-status-danger-fg font-medium">
              <Icon name="alert-circle" size={16} className="shrink-0 mt-px" />
              <span>{error}</span>
            </p>
          ) : helperText ? (
            <p id={`${id}-helper`} className="text-[13px] leading-[18px] text-text-muted">
              {helperText}
            </p>
          ) : (
            <span />
          )}
          {counter && <span className="text-xs text-text-muted tabular-nums shrink-0">{counter}</span>}
        </div>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, helperText?: string) {
  return error ? `${id}-error` : helperText ? `${id}-helper` : undefined;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: React.ReactNode | IconName;
  trailingElement?: React.ReactNode;
  required?: boolean;
  labelAside?: React.ReactNode;
  /** Optional wrapper class (the control keeps `className`). */
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      leadingIcon,
      trailingElement,
      id,
      disabled,
      required,
      labelAside,
      wrapperClassName,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const leading =
      typeof leadingIcon === 'string' ? <Icon name={leadingIcon as IconName} size={16} /> : leadingIcon;

    return (
      <FieldShell
        id={inputId}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
        labelAside={labelAside}
        className={cn('min-w-[200px]', wrapperClassName)}
      >
        <div className="relative flex items-center">
          {leading && (
            <div className="absolute left-3 flex items-center pointer-events-none text-icon-muted">{leading}</div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, error, helperText)}
            className={cn(
              CONTROL,
              'h-10',
              error && CONTROL_ERROR,
              leading ? 'pl-9' : 'pl-3',
              trailingElement ? 'pr-12' : 'pr-3',
              className
            )}
            {...props}
          />
          {trailingElement && <div className="absolute right-2.5 flex items-center">{trailingElement}</div>}
        </div>
      </FieldShell>
    );
  }
);
Input.displayName = 'Input';

/* ---------- Textarea (96 high, optional counter) ---------- */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  counter?: string;
  labelAside?: React.ReactNode;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, counter, labelAside, wrapperClassName, id, required, ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;
    return (
      <FieldShell
        id={fieldId}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
        counter={counter}
        labelAside={labelAside}
        className={wrapperClassName}
      >
        <textarea
          id={fieldId}
          ref={ref}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, error, helperText)}
          className={cn(CONTROL, 'min-h-24 px-3 py-2 resize-y', error && CONTROL_ERROR, className)}
          {...props}
        />
      </FieldShell>
    );
  }
);
Textarea.displayName = 'Textarea';

/* ---------- Select (native, DS-styled) ---------- */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  options?: SelectOption[];
  children?: React.ReactNode;
  labelAside?: React.ReactNode;
  wrapperClassName?: string;
  size?: never;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, helperText, placeholder, options, children, labelAside, wrapperClassName, id, required, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;
    return (
      <FieldShell
        id={fieldId}
        label={label}
        required={required}
        helperText={helperText}
        error={error}
        labelAside={labelAside}
        className={cn('min-w-[160px]', wrapperClassName)}
      >
        <div className="relative flex items-center">
          <select
            id={fieldId}
            ref={ref}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(fieldId, error, helperText)}
            className={cn(CONTROL, 'h-10 pl-3 pr-9 appearance-none cursor-pointer', error && CONTROL_ERROR, className)}
            {...props}
          >
            {placeholder !== undefined && (
              <option value="" disabled={required}>
                {placeholder}
              </option>
            )}
            {options?.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
            {children}
          </select>
          <Icon name="chevron-down" size={16} className="absolute right-3 pointer-events-none text-icon-default" />
        </div>
      </FieldShell>
    );
  }
);
Select.displayName = 'Select';

/* ---------- Input/Date (Date | Time | Date and time; 24-hour) ---------- */
export interface DateInputProps extends Omit<InputProps, 'type' | 'leadingIcon'> {
  kind?: 'date' | 'time' | 'datetime';
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(({ kind = 'date', ...props }, ref) => {
  const type = kind === 'datetime' ? 'datetime-local' : kind;
  return <Input ref={ref} type={type} leadingIcon={kind === 'time' ? 'clock' : 'calendar'} {...props} />;
});
DateInput.displayName = 'DateInput';

/* ---------- Input/Search (Small 32 | Medium 40) ---------- */
export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  /** Accessible name when there is no visible label. */
  label: string;
  wrapperClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ size = 'md', label, className, wrapperClassName, ...props }, ref) => (
    <div className={cn('relative flex items-center w-full', wrapperClassName)}>
      <Icon name="search" size={16} className="absolute left-3 pointer-events-none text-icon-muted" />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        className={cn(CONTROL, size === 'sm' ? 'h-8 text-[13px]' : 'h-10', 'pl-9 pr-3', className)}
        {...props}
      />
    </div>
  )
);
SearchInput.displayName = 'SearchInput';

/* ---------- Checkbox ---------- */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ label, className, id, ...props }, ref) => {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  return (
    <label htmlFor={fieldId} className={cn('inline-flex items-center gap-2 text-sm text-text-primary cursor-pointer select-none', className)}>
      <input
        id={fieldId}
        ref={ref}
        type="checkbox"
        className="w-4 h-4 rounded-xs border-border-input accent-[var(--brand-accent)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-default disabled:cursor-not-allowed"
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  );
});
Checkbox.displayName = 'Checkbox';
