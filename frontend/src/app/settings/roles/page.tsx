'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StateView } from '@/components/ui/State';

/**
 * Fixed v1 scope (docs/policy-baseline-2026-10-29.md, approved): four roles — Owner, Data Entry, Call Center,
 * Developer — and no custom-role management. The route stays so old links land on a plain explanation; the
 * server refuses role create/update/delete for everyone. (RoleEditor.tsx / roleMeta.ts are kept, unused.)
 */
export default function RolesStudioPage() {
  return (
    <AppShell>
      <div className="max-w-[1200px] mx-auto">
        <StateView
          type="empty"
          size="page"
          title="Custom roles are not part of v1"
          body="Udigity v1 has four fixed roles: Owner, Data Entry, Call Center and Developer. Assign one of them from the employee record."
        />
      </div>
    </AppShell>
  );
}
