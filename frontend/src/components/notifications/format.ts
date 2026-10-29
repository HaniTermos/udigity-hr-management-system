/**
 * Notification list helpers (SCR-SHR-007): relative time, a safe in-app link, and the row icon.
 * Pure functions so they can be unit-tested without a DOM.
 */
import type { IconName } from '@/components/ui/Icon';

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", then a short date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const ms = now.getTime() - at.getTime();
  if (Number.isNaN(ms)) return '';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: at.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

/** Only same-origin app paths are followed (never an absolute or protocol-relative URL). */
export function safeLink(link: string | undefined | null): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//') || link.startsWith('/\\')) return null;
  return link;
}

/** Row icon from the notification kind. */
export function notificationIcon(template: string): IconName {
  if (template.startsWith('security.')) return 'shield';
  if (template.includes('meeting')) return 'calendar';
  if (template.includes('follow_up')) return 'clock';
  if (template.includes('attendance')) return 'users';
  if (template.includes('correction') || template.includes('duplicate')) return 'edit';
  if (template.includes('delivery_failure') || template.includes('provisioning')) return 'alert-triangle';
  if (template.includes('deal') || template.includes('developer')) return 'briefcase';
  if (template.includes('assignment') || template.includes('reservation')) return 'phone';
  if (template.includes('digest')) return 'list';
  return 'bell';
}
