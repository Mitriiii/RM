import type { ReactNode } from 'react';

/**
 * The shared type system — see tailwind.config.ts for the underlying scale. Screens
 * compose from these rather than reaching for raw Tailwind text classes, so a later
 * change to the scale (or to which typeface carries which role) happens in one place.
 */

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-heading text-display font-semibold text-slate-900">{children}</h1>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-heading text-title font-semibold text-slate-900">{children}</h2>;
}

/** Sentence case only — CLAUDE.md forbids ALL-CAPS eyebrow labels. */
export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-label font-medium text-slate-700">
      {children}
    </label>
  );
}

export function Caption({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <p id={id} className={`text-caption text-slate-500 ${className}`}>
      {children}
    </p>
  );
}

export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-body text-slate-600 ${className}`}>{children}</p>;
}

/** A single plain-language restatement of numbers already shown elsewhere in their full,
 * technical form — never a substitute for them. Sized between SectionTitle and body text so
 * it reads as the sentence a first-time viewer meets before the dense table, not as another
 * stat card. */
export function Lede({
  children,
  className = '',
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <p data-testid={testId} className={`text-subtitle text-slate-800 ${className}`}>
      {children}
    </p>
  );
}

/** Every numeric value in the app renders through this — tabular figures, monospace,
 * so digits align in a column the way CLAUDE.md's "measuring instrument" direction asks. */
export function DataValue({
  children,
  size = 'data',
  className = '',
}: {
  children: ReactNode;
  size?: 'data' | 'data-lg';
  className?: string;
}) {
  const sizeClass = size === 'data-lg' ? 'text-data-lg' : 'text-data';
  return (
    <span className={`font-mono tabular-nums text-slate-900 ${sizeClass} ${className}`}>
      {children}
    </span>
  );
}
