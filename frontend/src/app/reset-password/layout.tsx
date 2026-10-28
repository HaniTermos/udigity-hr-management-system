import type { Metadata } from 'next';

// The reset link carries a one-time token in the URL: never send it as a Referer (SEC-4, checklist A5).
// The proxy also sets `Referrer-Policy: no-referrer` for this path; the meta tag survives any proxy that drops headers.
export const metadata: Metadata = { referrer: 'no-referrer' };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
