'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import {
  BusinessDetailsCard,
  type CategoryChoice,
  NotesCard,
  PhoneNumbersCard,
  SocialAccountsCard,
} from './BusinessFormCards';
import {
  emptyPhone,
  emptySocial,
  hasErrors,
  snapshot,
  summarize,
  validate,
  type BusinessFormErrors,
  type BusinessFormValues,
  type ErrorSummaryItem,
  type PhoneFormRow,
  type ServerFieldErrors,
  type SocialFormRow,
} from './businessFormModel';

export type FormStatusTone = 'neutral' | 'danger' | 'success';

export interface BusinessFormProps {
  /** Values the form starts from. Pass a new `formKey` to reset (e.g. after "Reload latest"). */
  initial: BusinessFormValues;
  formKey: string;
  /** Category choices; `inactive` ones are kept only so an existing business can still show its category. */
  categories: CategoryChoice[];
  submitLabel: string;
  /** Left side of the footer: system-set attribution text. */
  footerNote: React.ReactNode;
  /** Replaces the default status text when set (e.g. `Not saved — duplicate found`). */
  status?: { text: string; tone: FormStatusTone };
  isSaving?: boolean;
  /** Content between the header and the form: duplicate-blocked, conflict or success banners. */
  banner?: React.ReactNode;
  /** Server-side field errors (duplicate on a phone, name conflict) merged into the inline errors. */
  serverErrors?: Partial<ServerFieldErrors>;
  onClearServerErrors?: () => void;
  onSubmit: (values: BusinessFormValues) => void;
  onCancel: () => void;
  /** Reports the dirty state so the page can warn before leaving. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * The three-column Business form shared by SCR-DE-002 (create) and SCR-DE-004 (edit):
 * Business details | Phone numbers + Notes | Social accounts, and a footer with Cancel and Save.
 * Save validates every field at once: a summary at the top plus inline messages; summary links move focus.
 */
export function BusinessForm({
  initial,
  formKey,
  categories,
  submitLabel,
  footerNote,
  status,
  isSaving,
  banner,
  serverErrors,
  onClearServerErrors,
  onSubmit,
  onCancel,
  onDirtyChange,
}: BusinessFormProps) {
  // `formKey` remounts the form body, which is how callers reset it.
  return (
    <FormBody
      key={formKey}
      initial={initial}
      categories={categories}
      submitLabel={submitLabel}
      footerNote={footerNote}
      status={status}
      isSaving={isSaving}
      banner={banner}
      serverErrors={serverErrors}
      onClearServerErrors={onClearServerErrors}
      onSubmit={onSubmit}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  );
}

function FormBody({
  initial,
  categories,
  submitLabel,
  footerNote,
  status,
  isSaving,
  banner,
  serverErrors,
  onClearServerErrors,
  onSubmit,
  onCancel,
  onDirtyChange,
}: Omit<BusinessFormProps, 'formKey'>) {
  const [values, setValues] = useState<BusinessFormValues>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [baseline] = useState(() => snapshot(initial));
  const summaryRef = useRef<HTMLDivElement>(null);

  const clientErrors = useMemo(() => (submitted ? validate(values) : ({ phones: {}, social: {} } as BusinessFormErrors)), [submitted, values]);
  const errors: BusinessFormErrors = useMemo(
    () => ({
      ...clientErrors,
      name: clientErrors.name ?? serverErrors?.name,
      branch: clientErrors.branch ?? serverErrors?.branch,
      category: clientErrors.category ?? serverErrors?.category,
      website: clientErrors.website ?? serverErrors?.website,
      notes: clientErrors.notes ?? serverErrors?.notes,
      socialList: clientErrors.socialList ?? serverErrors?.socialList,
      phones: { ...(serverErrors?.phones ?? {}), ...clientErrors.phones },
      social: { ...(serverErrors?.social ?? {}), ...clientErrors.social },
    }),
    [clientErrors, serverErrors]
  );
  const summary: ErrorSummaryItem[] = useMemo(() => (submitted ? summarize(clientErrors, values) : []), [submitted, clientErrors, values]);
  const dirty = snapshot(values) !== baseline;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const patch = (next: Partial<BusinessFormValues>) => {
    setValues((v) => ({ ...v, ...next }));
    onClearServerErrors?.();
  };
  const patchPhone = (key: string, p: Partial<PhoneFormRow>) => patch({ phones: values.phones.map((r) => (r.key === key ? { ...r, ...p } : r)) });
  const patchSocial = (key: string, p: Partial<SocialFormRow>) => patch({ social: values.social.map((r) => (r.key === key ? { ...r, ...p } : r)) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values);
    setSubmitted(true);
    if (hasErrors(found)) {
      // Move focus to the summary so screen readers announce the problems (N4).
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    onSubmit(values);
  };

  const focusField = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  };

  const statusText = status?.text ?? (isSaving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Not saved yet');
  const statusTone = status?.tone ?? 'neutral';

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {banner}

      {summary.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg p-3.5 text-status-danger-fg outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="alert-circle" size={18} />
            {summary.length === 1 ? 'Fix 1 thing before saving' : `Fix ${summary.length} things before saving`}
          </p>
          <ul className="mt-1.5 list-disc pl-9 text-[13px] leading-[18px] space-y-0.5">
            {summary.map((s) => (
              <li key={`${s.fieldId}-${s.message}`}>
                <a href={`#${s.fieldId}`} onClick={focusField(s.fieldId)} className="underline underline-offset-2 font-medium">
                  {s.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-4 items-start">
        <BusinessDetailsCard values={values} errors={errors} categories={categories} onChange={patch} />
        <div className="flex flex-col gap-4">
          <PhoneNumbersCard
            rows={values.phones}
            errors={errors.phones}
            onChangeRow={patchPhone}
            onAdd={() => patch({ phones: [...values.phones, emptyPhone()] })}
            onRemove={(key) => patch({ phones: values.phones.filter((r) => r.key !== key) })}
          />
          <NotesCard value={values.notes} error={errors.notes} onChange={(notes) => patch({ notes })} />
        </div>
        <SocialAccountsCard
          rows={values.social}
          errors={errors.social}
          listError={errors.socialList}
          onChangeRow={patchSocial}
          onAdd={() => patch({ social: [...values.social, emptySocial()] })}
          onRemove={(key) => patch({ social: values.social.filter((r) => r.key !== key) })}
        />
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 px-1 pb-1 bg-surface-page">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border-default bg-surface-default px-5 py-4">
          <div className="flex-1 min-w-[200px] text-[13px] leading-[18px] text-text-secondary">{footerNote}</div>
          <span
            role="status"
            className={cn(
              'text-sm font-medium',
              statusTone === 'danger' ? 'text-status-danger-fg' : statusTone === 'success' ? 'text-status-success-fg' : 'text-text-secondary'
            )}
          >
            {statusText}
          </span>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
