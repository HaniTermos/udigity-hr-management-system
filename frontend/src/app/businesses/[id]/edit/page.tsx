'use client';

import React, { Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ApiError } from '@/lib/api/client';
import { duplicateMatchFrom, similarNamesFrom, updateBusiness, type BusinessDetail, type DuplicateMatch, type SimilarName } from '@/lib/api/businesses';
import { Alert } from '@/components/ui/Alert';
import { SaveConflict, conflictResult, type ConflictField } from '@/components/states';
import { NoticeAccess } from '@/components/ui/NoticeAccess';
import { useToast } from '@/components/ui/Toast';
import { BusinessForm } from '@/components/businesses/BusinessForm';
import {
  fromDetail,
  phoneKeyForMatch,
  toInput,
  mapServerErrors,
  type BusinessFormValues,
  type ServerFieldErrors } from '@/components/businesses/businessFormModel';
import { DuplicateBlockedBanner, SimilarNameDialog } from '@/components/businesses/DuplicateBlocked';
import { describeSaveError } from '@/components/businesses/saveErrors';
import { useAuth } from '@/lib/auth';
import { DetailSkeleton, ErrorState } from '@/components/businesses/AsyncState';
import { formatDateTime } from '@/components/businesses/format';
import { ACTIONS } from '@/lib/actions';
import { useBusiness, useBusinessAccess, useCategories, useCorrection } from '@/components/businesses/hooks';
import { PageHeader } from '@/components/businesses/PageHeader';
import { useUnsavedChangesGuard } from '@/components/businesses/useUnsavedChangesGuard';

interface ConflictState {
  latest: BusinessDetail;
  mine: BusinessFormValues;
}

const phonesText = (v: BusinessFormValues) =>
  v.phones
    .filter((p) => p.number.trim())
    .map((p) => `${p.countryCode} ${p.number}`.trim())
    .join(', ');
const socialText = (v: BusinessFormValues) =>
  v.social
    .filter((s) => s.handle.trim())
    .map((s) => `${s.platform} ${s.handle}${s.followersUnknown || !s.followers ? '' : ` (${s.followers})`}`.trim())
    .join(', ');

/** Compared fields for the SHR-014 diff: base (as opened), theirs (latest saved), mine (unsaved edit). */
function buildConflictFields(base: BusinessFormValues, theirs: BusinessFormValues, mine: BusinessFormValues, categoryName: (id: string) => string) {
  const defs: { key: string; label: string; get: (v: BusinessFormValues) => string }[] = [
    { key: 'name', label: 'Name', get: (v) => v.name },
    { key: 'branch', label: 'Branch', get: (v) => v.branch },
    { key: 'category', label: 'Category', get: (v) => categoryName(v.category) },
    { key: 'phones', label: 'Phone numbers', get: phonesText },
    { key: 'website', label: 'Website', get: (v) => (v.hasWebsite ? v.website : '') },
    { key: 'notes', label: 'Notes', get: (v) => v.notes },
    { key: 'social', label: 'Social accounts', get: socialText },
  ];
  const dash = (t: string) => t || '—';
  const all = defs.map((d) => ({ d, f: { base: d.get(base), theirs: d.get(theirs), mine: d.get(mine) } }));
  const fields: ConflictField[] = all
    .filter(({ f }) => conflictResult(f) !== 'none')
    .map(({ d, f }) => ({ key: d.key, label: d.label, base: dash(f.base), theirs: dash(f.theirs), mine: dash(f.mine) }));
  /** My edits on top of the latest: take mine wherever I changed the field, otherwise theirs. */
  const merged: BusinessFormValues = { ...theirs };
  const pick = (f: { base: string; mine: string }) => f.mine !== f.base;
  for (const { d, f } of all) {
    if (!pick(f)) continue;
    if (d.key === 'name') merged.name = mine.name;
    if (d.key === 'branch') merged.branch = mine.branch;
    if (d.key === 'category') merged.category = mine.category;
    if (d.key === 'phones') merged.phones = mine.phones;
    if (d.key === 'website') {
      merged.hasWebsite = mine.hasWebsite;
      merged.website = mine.website;
    }
    if (d.key === 'notes') merged.notes = mine.notes;
    if (d.key === 'social') merged.social = mine.social;
  }
  return { fields, merged };
}

interface FormState {
  initial: BusinessFormValues;
  key: string;
  version: number;
}

/** SCR-DE-004 Edit business. The record is excluded from its own duplicate check; a save conflict never overwrites. */
function EditBusinessContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { allowed } = useBusinessAccess();
  const { data, error, isLoading, mutate } = useBusiness(id);

  const correctionParam = useSearchParams().get('correction');

  if (!allowed(ACTIONS.businessUpdate)) return <NoticeAccess type="permission-denied" />;
  if (error || (!isLoading && !data)) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <DetailSkeleton />;
  if (data.archived) {
    return (
      <NoticeAccess
        type="permission-denied"
        title="Archived businesses cannot be edited"
        body="Restore the business first. Only the Owner can restore an archived business."
      />
    );
  }
  if (data.access === 'context_limited' && !correctionParam) {
    return (
      <NoticeAccess
        type="context-limited"
        title="Edit only through a correction request"
        body="Your access to this business is limited to applying a correction request. Open the request from the queue and choose Edit business."
      />
    );
  }
  // Mounted once per record: later refreshes never overwrite what the user typed.
  return <EditBusinessForm key={data.id} id={id} data={data} refresh={() => mutate()} setCache={(d) => mutate(d, { revalidate: false })} />;
}

function EditBusinessForm({
  id,
  data,
  refresh,
  setCache,
}: {
  id: string;
  data: BusinessDetail;
  refresh: () => Promise<BusinessDetail | undefined>;
  setCache: (d: BusinessDetail) => Promise<unknown>;
}) {
  const search = useSearchParams();
  const correctionId = search.get('correction');
  const router = useRouter();
  const toast = useToast();
  const { data: categories } = useCategories();
  const { data: correction } = useCorrection(correctionId);

  const [form, setForm] = useState<FormState>(() => ({ initial: fromDetail(data), key: `edit-${data.version}`, version: data.version }));
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [match, setMatch] = useState<DuplicateMatch | null>(null);
  const [serverErrors, setServerErrors] = useState<Partial<ServerFieldErrors>>();
  const [similar, setSimilar] = useState<SimilarName[] | null>(null);
  const pending = useRef<BusinessFormValues | null>(null);
  const { user } = useAuth();
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [base, setBase] = useState<BusinessFormValues>(() => fromDetail(data));
  const [saveError, setSaveError] = useState<string | null>(null);
  useUnsavedChangesGuard(dirty && !isSaving);

  const clearServerState = () => {
    setServerErrors(undefined);
    setMatch(null);
    setSaveError(null);
  };

  const categoryChoices = [
    ...(categories ?? []).filter((c) => c.active).map((c) => ({ id: c.id, name: c.name })),
    ...((categories ?? []).some((c) => c.id === data.categoryId && c.active)
      ? []
      : [{ id: data.categoryId, name: data.category, inactive: !data.categoryActive }]),
  ];
  const categoryName = (cid: string) => categoryChoices.find((c) => c.id === cid)?.name ?? '';

  const save = async (values: BusinessFormValues, confirmSimilar: boolean) => {
    setIsSaving(true);
    clearServerState();
    pending.current = values;
    try {
      const saved = await updateBusiness(id, {
        ...toInput(values),
        version: form.version,
        ...(correctionId ? { correctionId } : {}),
        ...(confirmSimilar ? { confirmSimilar: true } : {}),
      });
      setDirty(false);
      await setCache(saved);
      toast.show({
        tone: 'success',
        title: correctionId ? 'Changes saved, request resolved' : 'Changes saved',
        body: saved.phonesCollapsed ? `${saved.name} was updated. Repeated phone numbers were merged into one.` : `${saved.name} was updated.`,
      });
      router.push(`/businesses/${id}`);
      return;
    } catch (err) {
      const similarNames = similarNamesFrom(err);
      if (err instanceof ApiError && err.code === 'DUPLICATE_BLOCKED') {
        const m = duplicateMatchFrom(err.details);
        setMatch(m);
        const key = phoneKeyForMatch(values, m);
        setServerErrors(key ? { phones: { [key]: 'Already used by another business.' }, social: {} } : undefined);
      } else if (similarNames) {
        setSimilar(similarNames);
      } else if (err instanceof ApiError && err.isVersionConflict) {
        const latest = await refresh();
        if (latest) setConflict({ latest, mine: values });
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const { errors, other } = mapServerErrors(err.details, values);
        setServerErrors(errors);
        setSaveError(other[0] ?? describeSaveError(err, 'Some fields need attention.'));
      } else {
        setSaveError(describeSaveError(err, 'We could not save these changes. Your entries are kept; try again.'));
      }
    }
    setIsSaving(false);
  };

  const handleSubmit = (values: BusinessFormValues) => void save(values, false);

  const diff = conflict ? buildConflictFields(base, fromDetail(conflict.latest), conflict.mine, categoryName) : null;

  const banner = (
    <>
      {correction && correctionId && (
        <Alert
          tone="info"
          title={`Applying correction request · ${correction.issueType}`}
          body={`${correction.field ?? 'Business'}${correction.suggestedValue ? `, suggested ${correction.suggestedValue}` : ''}. ${
            correction.explanation ?? ''
          } The request resolves when you save. The duplicate check runs first; if it blocks the save, the request stays In review.`}
        />
      )}
      {correction && correctionId && (correction.status !== 'in_review' || (correction.reviewerId !== user?.id && user?.role !== 'owner')) && (
        <Alert
          tone="warning"
          title="This request is not in review under your name"
          body="Saving will be refused until you take the request in the queue. Nothing is changed in the meantime."
        />
      )}
      {match && <DuplicateBlockedBanner match={match} excludedSelf />}
      {data.phonesCollapsed && <Alert tone="info" title="Repeated phone numbers were merged" body="A phone listed twice on this record is stored once." />}
    </>
  );

  if (conflict && diff) {
    const latest = conflict.latest;
    return (
      <div className="space-y-4 max-w-[1200px] mx-auto">
        <SaveConflict
          entity="business"
          savedBy={latest.updatedBy ?? 'Someone else'}
          savedAt={formatDateTime(latest.updatedAt)}
          openedAt={formatDateTime(data.updatedAt)}
          fields={diff.fields}
          onReapply={() => {
            setBase(fromDetail(latest));
            setForm({ initial: diff.merged, key: `edit-${latest.version}-merged`, version: latest.version });
            setConflict(null);
            setDirty(true);
          }}
          onReload={() => {
            setBase(fromDetail(latest));
            setForm({ initial: fromDetail(latest), key: `edit-${latest.version}-reload`, version: latest.version });
            setConflict(null);
            setDirty(false);
          }}
          onCancel={() => router.push(`/businesses/${id}`)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1200px] mx-auto">
      <PageHeader
        breadcrumb={[{ label: 'Businesses', href: '/businesses' }, { label: data.name, href: `/businesses/${id}` }, { label: 'Edit' }]}
        title="Edit business"
        subtitle="Name and phone changes are re-checked for duplicates (this record excluded)."
        actions={
          <Link href={`/businesses/${id}?tab=history`} className="text-sm font-medium text-text-link hover:underline underline-offset-2">
            View edit history
          </Link>
        }
      />

      <BusinessForm
        initial={form.initial}
        formKey={form.key}
        categories={categoryChoices}
        submitLabel="Save changes"
        footerNote={
          <>
            <div>
              Created by {data.createdBy} · {formatDateTime(data.createdAt)}
            </div>
            <div>
              Last updated by {data.updatedBy ?? '—'} · {formatDateTime(data.updatedAt)}
            </div>
          </>
        }
        status={
          saveError
            ? { text: saveError, tone: 'danger' }
            : match
              ? { text: 'Not saved — duplicate found', tone: 'danger' }
              : undefined
        }
        isSaving={isSaving}
        banner={banner}
        serverErrors={serverErrors}
        onClearServerErrors={() => {
          if (serverErrors || match || saveError) clearServerState();
        }}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/businesses/${id}`)}
        onDirtyChange={setDirty}
      />
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

export default function EditBusinessPage() {
  return (
    <AppShell>
      <Suspense fallback={<DetailSkeleton />}>
        <EditBusinessContent />
      </Suspense>
    </AppShell>
  );
}
