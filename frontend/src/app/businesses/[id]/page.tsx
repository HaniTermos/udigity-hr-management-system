'use client';

import React, { Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ACTIONS } from '@/lib/actions';
import { AppShell } from '@/components/layout/AppShell';
import { BusinessDetailView } from '@/components/businesses/BusinessDetailView';
import { DetailSkeleton, ErrorState } from '@/components/businesses/AsyncState';
import { useBusiness, useBusinessAccess } from '@/components/businesses/hooks';
import { SubmitCorrectionDrawer } from '@/components/businesses/SubmitCorrectionDrawer';

/** SCR-SHR-008 Business detail (editing lives at /businesses/[id]/edit, SCR-DE-004). */
function BusinessDetailContent() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id ?? '';
  const { role, allowed } = useBusinessAccess();
  const { data, error, isLoading, mutate } = useBusiness(id);
  const [flagOpen, setFlagOpen] = useState(false);

  if (isLoading || !role) return <DetailSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => mutate()} />;

  const tab = search.get('tab');
  return (
    <>
      <BusinessDetailView
        business={data}
        role={role}
        onFlag={() => setFlagOpen(true)}
        onChanged={() => mutate()}
        initialTab={tab === 'history' || tab === 'related' ? tab : 'overview'}
      />
      {allowed(ACTIONS.correctionSubmit) && (
        <SubmitCorrectionDrawer
          isOpen={flagOpen}
          onClose={() => setFlagOpen(false)}
          business={{ id: data.id, name: data.name }}
          openRequests={data.corrections}
          fields={[
            'Business name',
            'Branch',
            'Category',
            ...data.phones.map((_, i) => `Phone ${i + 1}`),
            'Website',
            ...data.social.map((s) => `Social account · ${s.platform}`),
            'Notes',
            'Other',
          ]}
          onSubmitted={() => mutate()}
        />
      )}
    </>
  );
}

export default function BusinessDetailPage() {
  return (
    <AppShell>
      <Suspense fallback={<DetailSkeleton />}>
        <BusinessDetailContent />
      </Suspense>
    </AppShell>
  );
}
