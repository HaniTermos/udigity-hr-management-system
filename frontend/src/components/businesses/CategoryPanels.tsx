'use client';

import React, { useState } from 'react';
import type { CategoryRow } from '@/lib/api/businesses';
import { Button } from '@/components/ui/Button';
import { CardSection } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

/** Right column of SCR-DE-007: Add category card and the two pending-policy blocks. */
export function AddCategoryCard({
  existing,
  saving,
  serverError,
  onAdd,
  onEdit,
}: {
  existing: string[];
  saving: boolean;
  serverError?: string;
  onAdd: (name: string) => Promise<boolean>;
  onEdit?: () => void;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const clash = !!trimmed && existing.some((e) => e.toLowerCase() === trimmed.toLowerCase());
  const error = clash ? 'A category with this name already exists.' : serverError;

  return (
    <CardSection title="Add category" subtitle="Only the Owner adds, renames and deactivates categories.">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!trimmed || clash) return;
          if (await onAdd(trimmed)) setName('');
        }}
      >
        <Input
          label="Category name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onEdit?.();
          }}
          error={error}
          helperText="Checked against all categories, including inactive ones."
          maxLength={80}
          autoComplete="off"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setName('')} disabled={!name || saving}>
            Clear
          </Button>
          <Button type="submit" isLoading={saving} disabled={!trimmed || clash}>
            Add category
          </Button>
        </div>
      </form>
    </CardSection>
  );
}

/**
 * "Remove…" opens the removal-rule check; the rule itself is pending. A category in use cannot be removed and has no
 * Remove action. An unused category can only be deactivated (CR-1), shown as a demonstration alternative.
 */
export function RemoveCategoryDialog({
  category,
  busy,
  error,
  onClose,
  onDeactivate,
}: {
  category: CategoryRow | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onDeactivate: (row: CategoryRow) => void;
}) {
  if (!category) return null;
  const inUse = category.businessCount > 0;
  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={inUse ? 'In use — cannot remove' : `Deactivate ${category.name}?`}
      description={
        inUse
          ? `${category.name} is used by ${category.businessCount} ${category.businessCount === 1 ? 'business' : 'businesses'}.`
          : `${category.name} is not used by any business.`
      }
      maxWidth="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {inUse ? 'Close' : 'Cancel'}
          </Button>
          {!inUse && (
            <Button variant="destructive" isLoading={busy} onClick={() => onDeactivate(category)}>
              Deactivate
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="text-[13px] leading-[18px] font-medium text-status-danger-fg">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
