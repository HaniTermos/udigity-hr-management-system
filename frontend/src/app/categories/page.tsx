'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { ACTIONS } from '@/lib/actions';
import { ApiError } from '@/lib/api/client';
import { createCategory, deactivateCategory, renameCategory, type CategoryRow } from '@/lib/api/businesses';
import { Button } from '@/components/ui/Button';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { PolicyPendingChip } from '@/components/ui/NoticePolicy';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/businesses/AsyncState';
import { AddCategoryCard, CategoryPolicyNotes, RemoveCategoryDialog } from '@/components/businesses/CategoryPanels';
import { CategoryTable } from '@/components/businesses/CategoryTable';
import { useBusinessAccess, useCategories } from '@/components/businesses/hooks';
import { PageHeader } from '@/components/businesses/PageHeader';

/**
 * SCR-DE-007 "Data Entry denied": a full-page state for anyone who can manage no category. Never shows the list.
 * The server refuses create/rename/deactivate with 403 FORBIDDEN_ROLE for these roles (backend businesses/routes.ts).
 */
function CategoriesDenied() {
  return (
    <div className="w-full flex flex-col items-center gap-6 py-16">
      <NoticeAccess
        type="permission-denied"
        size="page"
        title="You cannot manage categories"
        body="Category management is for the Owner. Whether Data Entry may add or suggest categories depends on DEC-015, which is not decided."
        action={
          <Link href="/businesses">
            <Button variant="secondary">Back to businesses</Button>
          </Link>
        }
      />
      <PolicyPendingChip dec="DEC-015" demo />
    </div>
  );
}

/** SCR-DE-007 Categories. Owner manages; everyone else sees the denied state until DEC-015 decides. */
function CategoriesContent() {
  const toast = useToast();
  const { allowed } = useBusinessAccess();
  // The `/me` capabilities mirror the server guards (matrix rows 3.5: Owner only under the DEC-015 default CA-A).
  const canManage = allowed(ACTIONS.categoryRename);
  const canAdd = allowed(ACTIONS.categoryCreate);
  const canAny = canManage || canAdd || allowed(ACTIONS.categoryDeactivate);
  const { data, error, isLoading, mutate } = useCategories();

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string>();
  const [removing, setRemoving] = useState<CategoryRow | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string>();

  const fieldMessage = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      const named = err.fieldErrors.name?.[0];
      return named ?? err.message;
    }
    return fallback;
  };

  const handleAdd = async (name: string) => {
    setAdding(true);
    setAddError(undefined);
    try {
      await createCategory(name);
      await mutate();
      toast.show({ tone: 'success', title: 'Category added', body: name });
      return true;
    } catch (err) {
      setAddError(
        err instanceof ApiError && (err.code === 'PERMISSION_DENIED' || err.code === 'FORBIDDEN_ROLE')
          ? 'Only the Owner can add categories under the current rule (DEC-015, demonstration alternative — not approved).'
          : fieldMessage(err, 'We could not add this category. Try again.')
      );
      return false;
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (id: string, name: string) => {
    const row = data?.find((c) => c.id === id);
    setRenameSaving(true);
    setRenameError(undefined);
    try {
      await renameCategory(id, name, row?.version ?? 1);
      await mutate();
      setRenamingId(null);
      toast.show({ tone: 'success', title: 'Category renamed', body: name });
    } catch (err) {
      setRenameError(fieldMessage(err, 'We could not rename this category. Try again.'));
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDeactivate = async (row: CategoryRow) => {
    setRemoveBusy(true);
    setRemoveError(undefined);
    try {
      await deactivateCategory(row.id, row.version);
      await mutate();
      setRemoving(null);
      toast.show({ tone: 'success', title: 'Category deactivated', body: row.name });
    } catch (err) {
      setRemoveError(err instanceof ApiError && err.code === 'RULE_VIOLATION' ? 'This category cannot be removed.' : fieldMessage(err, 'That did not go through.'));
    } finally {
      setRemoveBusy(false);
    }
  };

  if (!allowed(ACTIONS.categoryList)) return <NoticeAccess type="permission-denied" />;
  if (!canAny) return <CategoriesDenied />;

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        title="Categories"
        subtitle={canManage ? 'Businesses pick one category from this list. Names are unique, including inactive ones.' : 'Businesses pick one category from this list. You see active categories only.'}
        chips={<PolicyPendingChip dec="DEC-015" demo />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          <CategoryTable
            rows={data ?? []}
            loading={isLoading}
            error={error ? <ErrorState error={error} onRetry={() => mutate()} /> : undefined}
            canManage={canManage}
            renamingId={renamingId}
            renameSaving={renameSaving}
            renameError={renameError}
            onStartRename={(id) => {
              setRenameError(undefined);
              setRenamingId(id);
            }}
            onCancelRename={() => setRenamingId(null)}
            onRename={handleRename}
            onRemove={(row) => {
              setRemoveError(undefined);
              setRemoving(row);
            }}
          />
          {canManage && (
            <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] text-text-secondary">
              <PolicyPendingChip dec="No DEC ID" demo />
              <span>Remove… deactivates a category and keeps it on existing businesses; the removal rule is not approved.</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {canAdd && (
          <AddCategoryCard
            existing={(data ?? []).map((c) => c.name)}
            saving={adding}
            serverError={addError}
            onEdit={() => setAddError(undefined)}
            onAdd={handleAdd}
          />
          )}
          <CategoryPolicyNotes />
        </div>
      </div>

      <RemoveCategoryDialog
        category={removing}
        busy={removeBusy}
        error={removeError}
        onClose={() => setRemoving(null)}
        onDeactivate={handleDeactivate}
      />
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <AppShell>
      <CategoriesContent />
    </AppShell>
  );
}
