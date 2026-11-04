'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACTIONS } from '@/lib/actions';
import { AppShell } from '@/components/layout/AppShell';
import { ApiError, newIdempotencyKey } from '@/lib/api/client';
import { createBusiness, duplicateMatchFrom, similarNamesFrom, type DuplicateMatch, type SimilarName } from '@/lib/api/businesses';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { useToast } from '@/components/ui/Toast';
import { BusinessForm } from '@/components/businesses/BusinessForm';
import { emptyFormValues, mapServerErrors, phoneKeyForMatch, toInput, type BusinessFormValues, type ServerFieldErrors } from '@/components/businesses/businessFormModel';
import { DuplicateBlockedDialog, SimilarNameDialog, type DuplicateReviewProbe } from '@/components/businesses/DuplicateBlocked';
import { describeSaveError } from '@/components/businesses/saveErrors';
import { PageHeader } from '@/components/businesses/PageHeader';
import { useBusinessAccess, useCategories } from '@/components/businesses/hooks';
import { ErrorState } from '@/components/businesses/AsyncState';
import { useUnsavedChangesGuard } from '@/components/businesses/useUnsavedChangesGuard';

/** SCR-DE-002 Create business. Duplicates are blocked with no bypass (SCR-DE-003). */
function CreateBusiness() {
  const router = useRouter();
  const toast = useToast();
  const { allowed } = useBusinessAccess();
  const { data: categories, error: categoriesError, mutate } = useCategories();

  const [initial] = useState(emptyFormValues);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [match, setMatch] = useState<DuplicateMatch | null>(null);
  // D10: the details of the blocked save, for "Request Owner review" (the server re-derives the match).
  const [reviewProbe, setReviewProbe] = useState<DuplicateReviewProbe | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<ServerFieldErrors>>();
  const [similar, setSimilar] = useState<SimilarName[] | null>(null);
  const pending = useRef<BusinessFormValues | null>(null);
  const idemKey = useRef(newIdempotencyKey());
  const [blocked, setBlocked] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useUnsavedChangesGuard(dirty && !isSaving);

  if (!allowed(ACTIONS.businessCreate)) {
    return <NoticeAccess type="permission-denied" />;
  }

  const save = async (values: BusinessFormValues, confirmSimilar: boolean) => {
    setIsSaving(true);
    setSaveError(null);
    pending.current = values;
    try {
      const saved = await createBusiness({ ...toInput(values), ...(confirmSimilar ? { confirmSimilar: true } : {}) }, idemKey.current);
      setDirty(false);
      toast.show({
        tone: 'success',
        title: 'Business saved',
        body: saved.phonesCollapsed ? `${saved.name} was added. Repeated phone numbers were merged into one.` : `${saved.name} was added.`,
      });
      router.push(`/businesses/${saved.id}`);
      return;
    } catch (err) {
      const similarNames = similarNamesFrom(err);
      if (err instanceof ApiError && err.code === 'DUPLICATE_BLOCKED') {
        const m = duplicateMatchFrom(err.details);
        setMatch(m);
        const input = toInput(values);
        setReviewProbe({ name: input.name, branch: input.branch, phones: input.phones });
        setDialogOpen(true);
        setBlocked(true);
        const key = phoneKeyForMatch(values, m);
        setServerErrors(key ? { phones: { [key]: 'Already used by another business.' }, social: {} } : undefined);
      } else if (similarNames) {
        setSimilar(similarNames);
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const { errors, other } = mapServerErrors(err.details, values);
        setServerErrors(errors);
        setSaveError(other[0] ?? describeSaveError(err, 'Some fields need attention.'));
      } else {
        setSaveError(describeSaveError(err, 'We could not save this business. Your entries are kept; try again.'));
      }
      // 5xx, timeouts and network errors leave the outcome unknown, so the retry must reuse the key. Only a definitive
      // 4xx answer (nothing was created) starts a new action.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        idemKey.current = newIdempotencyKey();
      }
    }
    setIsSaving(false);
  };

  const handleSubmit = (values: BusinessFormValues) => void save(values, false);

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        breadcrumb={[{ label: 'Businesses', href: '/businesses' }, { label: 'New business' }]}
        title="New business"
        subtitle="Duplicates are checked across all stored businesses when you save."
      />

      {categoriesError ? (
        <ErrorState error={categoriesError} onRetry={() => mutate()} />
      ) : (
        <BusinessForm
          initial={initial}
          formKey="create"
          categories={(categories ?? []).filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          submitLabel="Save business"
          footerNote="The system records who created and last updated this business when you save."
          status={
            saveError
              ? { text: saveError, tone: 'danger' }
              : blocked
                ? { text: 'Not saved — duplicate found', tone: 'danger' }
                : undefined
          }
          isSaving={isSaving}
          serverErrors={serverErrors}
          onClearServerErrors={() => {
            setServerErrors(undefined);
            setBlocked(false);
            setSaveError(null);
          }}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/businesses')}
          onDirtyChange={setDirty}
        />
      )}

      <DuplicateBlockedDialog open={dialogOpen} match={match} onClose={() => setDialogOpen(false)} reviewProbe={reviewProbe} />
      <SimilarNameDialog
        similar={similar}
        busy={isSaving}
        onClose={() => setSimilar(null)}
        onContinue={async () => {
          if (pending.current) await save(pending.current, true);
          setSimilar(null);
        }}
      />
    </div>
  );
}

export default function CreateBusinessPage() {
  return (
    <AppShell>
      <CreateBusiness />
    </AppShell>
  );
}
