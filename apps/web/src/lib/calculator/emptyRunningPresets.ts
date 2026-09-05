/**
 * Eurostat, "Road freight transport by journey characteristics" (online data code
 * tran_hv_ms_frmod): the share of vehicle-kilometres run empty is higher for national
 * transport than for international transport, because international loads are more often
 * backhauled. These are EU-wide averages, not Spain-specific — Eurostat does not publish a
 * Spain-only empty-running figure, and this product does not invent one (see CLAUDE.md
 * non-negotiable #2, applied here to data provenance, not just emission factors).
 */
export const EU_NATIONAL_EMPTY_RUNNING_RATE_PERCENT = 24;
export const EU_INTERNATIONAL_EMPTY_RUNNING_RATE_PERCENT = 13;
export const EMPTY_RUNNING_RATE_SOURCE =
  'Eurostat, Road freight transport by journey characteristics (EU average, national vs international)';

export interface EmptyRunningPreset {
  readonly value: number;
  readonly label: string;
}

export const EMPTY_RUNNING_PRESETS: readonly EmptyRunningPreset[] = [
  { value: EU_NATIONAL_EMPTY_RUNNING_RATE_PERCENT, label: 'EU national average — 24%' },
  { value: EU_INTERNATIONAL_EMPTY_RUNNING_RATE_PERCENT, label: 'EU international average — 13%' },
];
