import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';
import './globals.css';

/**
 * Three typefaces, each with one job — CLAUDE.md's "pick one or two typefaces
 * deliberately and set a real type scale," extended to three because numeric data
 * genuinely needs its own: a serif for headings signals editorial/technical weight
 * rather than generic SaaS; Inter carries prose; IBM Plex Mono carries every number,
 * so tabular figures read like an instrument's readout, not a dashboard's stat card.
 */
const headingFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600'],
  style: ['normal'],
});

const bodyFont = Inter({ subsets: ['latin'], variable: '--font-sans' });

const dataFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Freyo',
  description: 'Audit-grade freight emissions measurement and pooled backhaul matching.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable} ${dataFont.variable}`}>
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
