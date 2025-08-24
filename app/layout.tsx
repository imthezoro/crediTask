import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'PromptOK',
  description: 'Minimal prompt enhancement MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script src="/extension-sync.js" defer></script>
        <Analytics />
      </body>
    </html>
  );
}


