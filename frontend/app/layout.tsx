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
    // Extensions (Grammarly, ColorZilla, QuillBot) write attributes onto
    // <html>/<body> before React hydrates, which reads as a hydration
    // mismatch. suppressHydrationWarning applies one level deep, to these
    // two elements' own attributes only, so real mismatches inside the app
    // still surface normally.
    <html
      lang="en"
      className={`${manrope.variable} ${grotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-canvas text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
