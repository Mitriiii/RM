import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freyo',
  description: 'Audit-grade freight emissions measurement and pooled backhaul matching.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
