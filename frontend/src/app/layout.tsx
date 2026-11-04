import type { Metadata } from 'next';
import { headers } from 'next/headers';
// Inter is bundled with the app (served from our own domain): no request to Google at build or run time.
import '@fontsource-variable/inter';
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
      <body>
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
