import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ThemeProvider } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import { GlobalErrorRouting } from '@/components/layout/GlobalErrorRouting';

export const metadata: Metadata = {
  title: 'Udigity Management System',
  description: 'Udigity Internal Management System (Attendance, Data Entry, Outreach & Delivery)',
};

// Reads the per-request CSP nonce from the proxy (src/proxy.ts), so every page renders dynamically.
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider nonce={nonce}>
          <ToastProvider>
            <AuthProvider>
              <GlobalErrorRouting>{children}</GlobalErrorRouting>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
