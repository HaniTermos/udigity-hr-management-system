import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { CardInset, CardSection } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Checkbox, DateInput, FieldShell, Input, Select, Textarea } from '@/components/ui/Input';
import {
  COUNTRY_CODES,
  FIELD_IDS,
  NOTES_MAX,
  PLATFORMS,
  type BusinessFormErrors,
  type BusinessFormValues,
  type PhoneFormRow,
  type SocialFormRow } from './businessFormModel';

export interface CategoryChoice {
  id: string;
  name: string;
  inactive?: boolean;
}

type Patch = (next: Partial<BusinessFormValues>) => void;

/* ---------------- Business details ---------------- */

export function BusinessDetailsCard({
  values,
  errors,
  categories,
  onChange,
}: {
  values: BusinessFormValues;
  errors: BusinessFormErrors;
  categories: CategoryChoice[];
  onChange: Patch;
}) {
  const websiteId = FIELD_IDS.website;
  return (
    <CardSection title="Business details">
      <div className="flex flex-col gap-3">
        <Input
          id={FIELD_IDS.name}
          label="Business name"
          required
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          error={errors.name}
          helperText="Name and phones are used to find duplicates."
          autoComplete="off"
        />
        <Input
          id={FIELD_IDS.branch}
          label="Branch or location (optional)"
          value={values.branch}
          onChange={(e) => onChange({ branch: e.target.value })}
          error={errors.branch}
          helperText="Same name in another branch is a different business."
          maxLength={120}
          autoComplete="off"
        />

        <Select
          id={FIELD_IDS.category}
          label="Category"
          required
          placeholder="Choose a category"
          value={values.category}
          onChange={(e) => onChange({ category: e.target.value })}
          options={categories.map((c) => ({ value: c.id, label: c.inactive ? `${c.name} (inactive)` : c.name }))}
          error={errors.category}
        />
        <div className="flex flex-col items-start gap-2">
          <Link href="/categories" className="text-[13px] leading-[18px] font-medium text-text-link hover:underline underline-offset-2">
            View categories
          </Link>
        </div>

        <Checkbox
          label="Has website"
          checked={values.hasWebsite}
          onChange={(e) => onChange({ hasWebsite: e.target.checked, website: e.target.checked ? values.website : '' })}
        />
        {values.hasWebsite && (
          <FieldShell id={websiteId} label="Website address" required error={errors.website}>
            <div
              className={cn(
                'flex items-center h-10 rounded-md border bg-surface-default text-sm text-text-primary',
                'focus-within:shadow-[inset_0_0_0_2px_var(--focus-ring)] focus-within:border-focus-ring',
                errors.website ? 'border-status-danger-solid' : 'border-border-input hover:border-text-secondary'
              )}
            >
              <span aria-hidden className="pl-3 pr-1 text-text-muted select-none">
                https://
              </span>
              <input
                id={websiteId}
                type="text"
                inputMode="url"
                aria-label="Website address"
                aria-required
                aria-invalid={errors.website ? true : undefined}
                aria-describedby={errors.website ? `${websiteId}-error` : undefined}
                value={values.website}
                onChange={(e) => onChange({ website: e.target.value })}
                className="flex-1 min-w-0 h-full bg-transparent pr-3 outline-none placeholder:text-text-placeholder"
                placeholder="example.com"
                autoComplete="off"
              />
            </div>
          </FieldShell>
        )}
      </div>
    </CardSection>
  );
}

/* ---------------- Phone numbers ---------------- */

export function PhoneNumbersCard({
  rows,
  errors,
  onChangeRow,
  onAdd,
  onRemove,
}: {
  rows: PhoneFormRow[];
  errors: Record<string, string>;
  onChangeRow: (key: string, patch: Partial<PhoneFormRow>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  return (
    <CardSection
      title="Phone numbers"
      action={
        <Button type="button" variant="link" onClick={onAdd}>
          Add phone
        </Button>
      }
    >
      {rows.length === 0 && <p className="text-[13px] leading-[18px] text-text-muted">No phone yet. A business without a phone is not eligible for calling.</p>}
      <div className="flex flex-col gap-3">
        {rows.map((p, i) => {
          const id = FIELD_IDS.phone(p.key);
          const error = errors[p.key];
          return (
            <div key={p.key} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium leading-5 text-text-primary">
                Phone {i + 1}
              </label>
              <div className="flex items-start gap-2">
                <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2 flex-1 min-w-0">
                  <Select
                    aria-label={`Phone ${i + 1} country code`}
                    value={p.countryCode}
                    onChange={(e) => onChangeRow(p.key, { countryCode: e.target.value })}
                    placeholder="Code"
                    options={[
                      ...(COUNTRY_CODES as readonly string[]).map((c) => ({ value: c, label: c })),
                      ...(!p.countryCode || (COUNTRY_CODES as readonly string[]).includes(p.countryCode) ? [] : [{ value: p.countryCode, label: p.countryCode }]),
                    ]}
                    wrapperClassName="min-w-0"
                    className="pl-2 pr-6"
                  />
                  <Input
                    id={id}
                    type="tel"
                    inputMode="tel"
                    value={p.number}
                    onChange={(e) => onChangeRow(p.key, { number: e.target.value })}
                    placeholder="70 000 000"
                    wrapperClassName="min-w-0"
                    autoComplete="off"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-msg` : undefined}
                    className={error ? 'border-status-danger-solid' : undefined}
                  />
                </div>
                <IconButton icon="trash" label={`Remove phone ${i + 1}`} variant="ghost" onClick={() => onRemove(p.key)} />
              </div>
              {error && (
                <p id={`${id}-msg`} className="flex items-start gap-1.5 text-[13px] leading-[18px] font-medium text-status-danger-fg">
                  <Icon name="alert-circle" size={16} className="shrink-0 mt-px" />
                  <span>{error}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </CardSection>
  );
}

/* ---------------- Notes ---------------- */

export function NotesCard({ value, error, onChange }: { value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <CardSection title="Notes">
      <Textarea
        id={FIELD_IDS.notes}
        aria-label="Notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        helperText="Visible to your team."
        counter={`${value.length} / ${NOTES_MAX}`}
      />
    </CardSection>
  );
}

/* ---------------- Social accounts ---------------- */

function SocialRow({
  index,
  row,
  errors,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  row: SocialFormRow;
  errors: BusinessFormErrors['social'][string] | undefined;
  canRemove: boolean;
  onChange: (patch: Partial<SocialFormRow>) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  return (
    <CardInset className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-start">
        <Select
          id={FIELD_IDS.socialPlatform(row.key)}
          label="Platform"
          required
          placeholder="Choose"
          value={row.platform}
          onChange={(e) => onChange({ platform: e.target.value })}
          options={PLATFORMS.map((p) => ({ value: p, label: p }))}
          error={errors?.platform}
        />
        <Input
          id={FIELD_IDS.socialHandle(row.key)}
          label="Handle or link"
          required
          value={row.handle}
          onChange={(e) => onChange({ handle: e.target.value })}
          error={errors?.handle}
          autoComplete="off"
        />
        <IconButton
          icon="trash"
          label={`Remove social account ${n}`}
          variant="ghost"
          disabled={!canRemove}
          onClick={onRemove}
          className="sm:mt-[26px]"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <Input
            id={FIELD_IDS.socialFollowers(row.key)}
            label="Followers"
            required
            inputMode="numeric"
            value={row.followersUnknown ? '' : row.followers}
            placeholder={row.followersUnknown ? 'Unknown' : undefined}
            disabled={row.followersUnknown}
            onChange={(e) => onChange({ followers: e.target.value })}
            error={errors?.followers}
            wrapperClassName="min-w-0 flex-1"
            className="text-right"
          />
          <Checkbox
            label="Unknown"
            checked={row.followersUnknown}
            onChange={(e) => onChange({ followersUnknown: e.target.checked, followers: e.target.checked ? '' : row.followers })}
            className="mt-[34px]"
          />
        </div>
        <div className="flex items-start gap-2">
          <DateInput
            id={FIELD_IDS.socialLastPost(row.key)}
            label="Last post"
            required
            value={row.lastPostUnknown ? '' : row.lastPost}
            disabled={row.lastPostUnknown}
            onChange={(e) => onChange({ lastPost: e.target.value })}
            error={errors?.lastPost}
            wrapperClassName="min-w-0 flex-1"
          />
          <Checkbox
            label="Unknown"
            checked={row.lastPostUnknown}
            onChange={(e) => onChange({ lastPostUnknown: e.target.checked, lastPost: e.target.checked ? '' : row.lastPost })}
            className="mt-[34px]"
          />
        </div>
      </div>
    </CardInset>
  );
}

export function SocialAccountsCard({
  rows,
  errors,
  listError,
  onChangeRow,
  onAdd,
  onRemove,
}: {
  rows: SocialFormRow[];
  errors: BusinessFormErrors['social'];
  listError?: string;
  onChangeRow: (key: string, patch: Partial<SocialFormRow>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  return (
    <CardSection
      title="Social accounts"
      action={
        <Button id={FIELD_IDS.addSocial} type="button" variant="link" onClick={onAdd}>
          Add account
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-text-secondary">
        <span className={listError ? 'text-status-danger-fg font-medium' : undefined}>
          {listError ?? 'At least one account is required.'}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <SocialRow
            key={r.key}
            index={i}
            row={r}
            errors={errors[r.key]}
            canRemove={rows.length > 1}
            onChange={(patch) => onChangeRow(r.key, patch)}
            onRemove={() => onRemove(r.key)}
          />
        ))}
      </div>
    </CardSection>
  );
}
