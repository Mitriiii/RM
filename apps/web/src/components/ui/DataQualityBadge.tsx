export type DataQualityGrade = 'primary' | 'modelled' | 'default';

const GRADE_LABEL: Record<DataQualityGrade, string> = {
  primary: 'Primary',
  modelled: 'Modelled',
  default: 'Default',
};

const GRADE_TITLE: Record<DataQualityGrade, string> = {
  primary: 'Measured from metered fuel or telematics data.',
  modelled: 'Estimated from a model, not directly metered.',
  default: 'Registry default value — the least certain grade.',
};

/**
 * Colour here carries meaning, not decoration — CLAUDE.md's one sanctioned use of
 * colour-as-signal. This is a certainty gradient (measured -> modelled -> default), never
 * a good/bad judgement, which is exactly why there is no green in it anywhere.
 */
export function DataQualityBadge({ grade }: { grade: DataQualityGrade }) {
  return (
    <span
      title={GRADE_TITLE[grade]}
      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-caption font-medium ${
        grade === 'primary'
          ? 'border-dataQuality-primary/30 text-dataQuality-primary'
          : grade === 'modelled'
            ? 'border-dataQuality-modelled/30 text-dataQuality-modelled'
            : 'border-dataQuality-default/30 text-dataQuality-default'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          grade === 'primary'
            ? 'bg-dataQuality-primary'
            : grade === 'modelled'
              ? 'bg-dataQuality-modelled'
              : 'bg-dataQuality-default'
        }`}
        aria-hidden="true"
      />
      {GRADE_LABEL[grade]}
    </span>
  );
}
