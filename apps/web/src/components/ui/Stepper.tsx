export interface StepperStep {
  readonly id: string;
  readonly label: string;
}

/**
 * A real progress control, not grey text describing state without showing it: a
 * completed step gets a filled marker and a check, the current step gets a solid ring,
 * an upcoming step is visibly present but visibly inert (dashed outline, muted) — never
 * hidden or removed, so a prospect can see the whole path before starting it.
 */
export function Stepper({
  steps,
  currentIndex,
}: {
  steps: readonly StepperStep[];
  currentIndex: number;
}) {
  return (
    <ol className="flex flex-nowrap items-center gap-3">
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={step.id} className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-medium ${
                  state === 'complete'
                    ? 'bg-slate-900 text-white'
                    : state === 'current'
                      ? 'border-2 border-slate-900 text-slate-900'
                      : 'border border-dashed border-slate-300 text-slate-400'
                }`}
                aria-hidden="true"
              >
                {state === 'complete' ? '✓' : index + 1}
              </span>
              <span
                className={`whitespace-nowrap text-label ${
                  state === 'upcoming' ? 'text-slate-400' : 'font-medium text-slate-900'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className={`h-px w-8 shrink-0 ${state === 'complete' ? 'bg-slate-900' : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
