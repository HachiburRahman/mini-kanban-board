import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';

// Two typefaces, one job each: Space Grotesk carries the brand and headings,
// Manrope does the reading work. Self-hosted by next/font, so there is no
// render-blocking request to a font CDN and no flash of fallback text.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'A collaborative kanban board for small teams',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximum-scale / user-scalable=no: pinch-zoom stays available.
  themeColor: '#f7f6f3',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${grotesk.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink">{children}</body>
    </html>
  );
}
