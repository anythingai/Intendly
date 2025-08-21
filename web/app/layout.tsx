/**
 * @fileoverview Root layout with providers
 * @description Next.js app layout with all necessary providers and global styles
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProviders, ToastContainer } from '../lib/providers/AppProviders.js';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Intent Trading Aggregator',
  description: 'Intent-based trading aggregator for optimal DeFi execution on L2s',
  keywords: ['DeFi', 'trading', 'intent-based', 'aggregator', 'L2', 'X Layer'],
  authors: [{ name: 'Intent Trading Team' }],
  creator: 'Intent Trading Team',
  publisher: 'Intent Trading Team',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Intent Trading Aggregator',
    description: 'Intent-based trading aggregator for optimal DeFi execution on L2s',
    siteName: 'Intent Trading Aggregator',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Intent Trading Aggregator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Intent Trading Aggregator',
    description: 'Intent-based trading aggregator for optimal DeFi execution on L2s',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add verification tokens when available
    // google: 'google-verification-token',
    // yandex: 'yandex-verification-token',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProviders>
          <div className="flex min-h-screen flex-col">
            <main className="flex-1">
              {children}
            </main>
          </div>
          <ToastContainer />
        </AppProviders>
      </body>
    </html>
  );
}