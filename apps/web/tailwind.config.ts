import type { Config } from 'tailwindcss';

/**
 * Design tokens shared across the app — CLAUDE.md's "set a real type scale," not ad hoc
 * classes scattered per screen. Later screens (the report in kickoff Session 6.6, the
 * Corridor Index, etc.) should extend this file rather than reinvent their own scale.
 *
 * Colour: data-quality grades are the one place CLAUDE.md sanctions colour carrying
 * semantic meaning. `dataQuality.primary/modelled/default` is a certainty gradient
 * (measured fact -> modelled estimate -> registry default), not a good/bad judgement —
 * there is deliberately no green anywhere in it.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        heading: ['var(--font-heading)', 'ui-serif', 'Georgia'],
        mono: ['var(--font-mono)', 'ui-monospace'],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        title: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.005em' }],
        subtitle: ['1rem', { lineHeight: '1.4' }],
        body: ['0.9375rem', { lineHeight: '1.6' }],
        label: ['0.8125rem', { lineHeight: '1.4' }],
        caption: ['0.75rem', { lineHeight: '1.4' }],
        data: ['0.9375rem', { lineHeight: '1.4' }],
        'data-lg': ['1.75rem', { lineHeight: '1.15' }],
      },
      colors: {
        dataQuality: {
          primary: '#1e3a5f', // measured fact — deepest, most certain
          modelled: '#8a5a1e', // modelled estimate — amber, mid-certainty
          default: '#6b7280', // registry default — neutral grey, least certain
        },
      },
    },
  },
  plugins: [],
};

export default config;
