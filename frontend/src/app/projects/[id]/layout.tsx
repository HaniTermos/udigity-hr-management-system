import type { Metadata } from 'next';

// Per-page document title (WCAG 2.4.2); the root layout adds the " | Udigity" suffix.
export const metadata: Metadata = { title: 'Project board' };

export default function ProjectsIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
