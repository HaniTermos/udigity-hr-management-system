import type { Metadata } from 'next';

// Per-page document title (WCAG 2.4.2); the root layout adds the " | Udigity" suffix.
export const metadata: Metadata = { title: 'Calling queue' };

export default function QueueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
