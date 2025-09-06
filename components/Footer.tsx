"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain } from 'lucide-react';
import React from 'react';

const ALLOWED_PATHS = new Set<string>([
  '/',
  '/settings',
  '/pricing',
  '/faq',
  '/contact',
  '/terms',
  '/refund-policy',
]);

export default function Footer() {
  const pathname = usePathname();

  // Only show footer on specific routes
  if (!pathname || !ALLOWED_PATHS.has(pathname)) {
    return null;
  }

  return (
    <footer className="bg-gray-800 text-gray-300 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-6 w-6 text-blue-400" />
              <span className="text-xl font-bold text-white">PromptOK</span>
            </div>
            <p className="text-sm text-gray-400">
              Enhance your AI prompts with intelligent suggestions and optimization.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Connect</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/signin" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} PromptOK. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
