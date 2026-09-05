'use client';

import { useState } from 'react';

/**
 * An on-demand plain-language explanation, not a bare tooltip — CLAUDE.md's design rules
 * and the market-ready kickoff's own guardrail both rule out a tooltip that just expands an
 * acronym. Renders inline (never absolutely positioned) so it can't get clipped by a
 * horizontally scrolling table container; clicking only ever adds content below the trigger,
 * never removes anything already on screen.
 */
export function InfoToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-block align-middle">
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-400 text-[10px] font-medium leading-none text-slate-500 hover:border-slate-600 hover:text-slate-700 print:hidden"
      >
        {open ? '×' : 'i'}
      </button>
      {open && (
        <span className="mt-1 block w-56 whitespace-normal border border-slate-300 bg-white p-2 text-left align-top text-caption font-normal text-slate-700 shadow-sm">
          {children}
        </span>
      )}
    </span>
  );
}
