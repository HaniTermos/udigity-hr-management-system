'use client';

import React, { useRef, useState } from 'react';
import { ApiError, newIdempotencyKey } from '@/lib/api/client';
import type { BusinessCorrectionSummary } from '@/lib/api/businesses';
import { CORRECTION_ISSUE_TYPES, submitCorrection, type CorrectionRow } from '@/lib/api/corrections';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { NoticePolicy } from '@/components/ui/NoticePolicy';
import { useToast } from '@/components/ui/Toast';
import { formatDay } from './format';

const DEFAULT_FIELDS = ['Business name', 'Category', 'Phone 1', 'Phone 2', 'Website', 'Social account', 'Notes', 'Other'];
const DESCRIPTION_MAX = 1000;

export interface SubmitCorrectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  business: { id: string; name: string };
  /** Open requests already on this business: shown as a warning, never as a block. */
  openRequests?: BusinessCorrectionSummary[];
  /** Field choices (e.g. `Phone 1`, `Social account · Instagram`). */
  fields?: string[];
  onSubmitted?: (row: CorrectionRow) => void;
}

/**
 * SCR-SHR-009 Submit data correction. Shared by Data Entry, Call Center and Developer: they all reach it from the
 * business detail ("Flag incorrect data", "Request correction"). Existing open requests warn but do not block.
 * Recipients and notification have no DEC ID, so that notice stays on screen.
 */
export function SubmitCorrectionDrawer(props: SubmitCorrectionDrawerProps) {
  if (!props.isOpen) return null;
  return <OpenDrawer {...props} />;
}

function OpenDrawer({ onClose, business, openRequests = [], fields = DEFAULT_FIELDS, onSubmitted }: SubmitCorrectionDrawerProps) {
  const toast = useToast();
  const [issueType, setIssueType] = useState('');
  const [field, setField] = useState('');
  const [description, setDescription] = useState('');
  const [suggested, setSuggested] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  const errors = {
    issueType: tried && !issueType ? 'Choose the issue type.' : undefined,
    description: tried && !description.trim() ? 'Describe what is wrong.' : undefined,
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setServerError(null);
    if (!issueType || !description.trim()) return;
    setSaving(true);
    try {
      // One key per submit action; a retry after a timeout / 5xx reuses it, a definitive 4xx or success renews it.
      if (!keyRef.current) keyRef.current = newIdempotencyKey();
      const row = await submitCorrection(
        {
          businessId: business.id,
          issueType,
          field: field || null,
          description: description.trim(),
          suggestedValue: suggested.trim() || null,
        },
        keyRef.current
      );
      keyRef.current = null;
      toast.show({ tone: 'success', title: 'Request submitted', body: 'Data Entry will review it.' });
      onSubmitted?.(row);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) keyRef.current = null;
      setServerError(err instanceof ApiError ? err.message : 'We could not submit this request. Your text is kept; try again.');
      setSaving(false);
    }
  };

  const first = openRequests[0];

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title="Flag incorrect data"
      subtitle={`${business.name} · reviewed by Data Entry`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="submit-correction-form" isLoading={saving}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="submit-correction-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {openRequests.length > 0 && (
          <Alert
            tone="warning"
            title={openRequests.length === 1 ? '1 open request already exists' : `${openRequests.length} open requests already exist`}
            body={`${first.issueType} — ${first.status === 'in_review' ? 'In review' : 'Submitted'} since ${formatDay(first.since).replace(/ \d{4}$/, '')}. You can still report a different issue.`}
          />
        )}
        {serverError && <Alert tone="danger" title="Not submitted" body={serverError} />}

        <Select
          label="Issue type"
          required
          placeholder="Choose an issue type"
          value={issueType}
          onChange={(e) => setIssueType(e.target.value)}
          options={CORRECTION_ISSUE_TYPES.map((t) => ({ value: t, label: t }))}
          error={errors.issueType}
        />
        <Select
          label="Field"
          placeholder="Not a specific field"
          value={field}
          onChange={(e) => setField(e.target.value)}
          options={fields.map((f) => ({ value: f, label: f }))}
        />
        <Textarea
          label="What is wrong?"
          required
          value={description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          counter={`${description.length} / ${DESCRIPTION_MAX}`}
          error={errors.description}
        />
        <Input
          label="Suggested value (optional)"
          value={suggested}
          onChange={(e) => setSuggested(e.target.value)}
          helperText="Checked only when Data Entry applies it."
          autoComplete="off"
        />
        <NoticePolicy size="inline" demo dec="No DEC ID" body="Who receives the request and how they are notified are not decided." />
      </form>
    </Drawer>
  );
}
