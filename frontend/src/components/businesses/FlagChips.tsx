import React from 'react';
import type { BusinessFlag } from '@/lib/api/businesses';
import { Badge } from '@/components/ui/Badge';

const LABEL: Record<BusinessFlag, string> = {
  correction_requested: 'Correction requested',
  no_phone: 'No phone',
  hidden_from_others: 'Hidden from other roles',
  archived: 'Archived',
};

/** Flags column of the directory and search rows. Empty renders an em dash. */
export function FlagChips({ flags, openCorrections }: { flags: BusinessFlag[]; openCorrections?: number }) {
  if (flags.length === 0) {
    return (
      <span className="text-text-muted" aria-label="No flags">
        —
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} tone={f === 'correction_requested' ? 'warning' : f === 'hidden_from_others' ? 'policy' : 'neutral'} icon="flag">
          {LABEL[f]}
          {f === 'correction_requested' && openCorrections && openCorrections > 1 ? ` (${openCorrections})` : ''}
        </Badge>
      ))}
    </div>
  );
}
