import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Inter } from 'next/font/google';
import Footer from '@/components/Footer';

// Configure Inter font with optimal settings
const inter = Inter({ 
  subsets: ['latin'], 
  display: 'swap',
  preload: true 
});

export const metadata: Metadata = {
  title: 'PromptOK',
  description: 'Minimal prompt enhancement MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        {children}
        <Footer />
        <script src="/extension-sync.js" defer></script>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
