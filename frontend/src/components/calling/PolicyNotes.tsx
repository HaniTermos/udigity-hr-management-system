import React from 'react';
import { NoticePolicy, PolicyPendingChip } from '@/components/ui/NoticePolicy';

/**
 * Pending policies on Call Center screens. All run on demonstration defaults, never decided:
 * plan §6 / agent-rules 6. "Accepted keeps reservation" is the only approved rule (U-01) and is not chipped.
 */
export const ReservationPolicyNotice = ({ className }: { className?: string }) => (
  <NoticePolicy
    size="block"
    dec="DEC-004"
    demo
    body="Lease length, idle rule and Owner override are undecided; times shown are illustrative."
    className={className}
  />
);

export const ReopenPolicyChip = () => <PolicyPendingChip dec="DEC-016" demo />;
export const OverdueThresholdChip = () => <PolicyPendingChip dec="Overdue threshold (no DEC ID)" demo />;
