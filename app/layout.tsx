import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PromptOK',
  description: 'Minimal prompt enhancement MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


