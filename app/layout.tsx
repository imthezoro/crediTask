import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'PromptOK',
  description: 'Minimal prompt enhancement MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Global Footer */}
        <footer className="mt-16 border-t bg-white/80">
          <div className="container mx-auto max-w-6xl px-4 py-8 text-sm text-gray-600">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <p className="text-center md:text-left">© {new Date().getFullYear()} PromptOK. All rights reserved.</p>
              <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                <Link href="/faq" className="hover:text-blue-700 text-blue-600">FAQ</Link>
                <Link href="/contact" className="hover:text-blue-700 text-blue-600">Contact</Link>
                <Link href="/terms" className="hover:text-blue-700 text-blue-600">Terms</Link>
                <Link href="/privacy" className="hover:text-blue-700 text-blue-600">Privacy</Link>
                <Link href="/refund-policy" className="hover:text-blue-700 text-blue-600">Refund Policy</Link>
              </nav>
            </div>
          </div>
        </footer>
        <script src="/extension-sync.js" defer></script>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
