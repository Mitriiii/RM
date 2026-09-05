# 0006 — A shared design-token system for apps/web

## Context

The live diagnostic (kickoff Session 6) worked correctly but looked like a bare form: a
page title, one paragraph, a step list where only step 1 visually read as reachable, and
an unstyled file input. A companion kickoff ("make Freyo market-ready," Session 6.5) asked
for the screen to actually look like the "measuring instrument" CLAUDE.md's design section
describes, and — critically — for the design tokens to live somewhere shared so later
screens (the report rebuild in Session 6.6, the Corridor Index, etc.) reuse them instead of
each screen inventing its own type scale.

## Decisions

**Three typefaces, each with one job**, set up via `next/font/google` in
`apps/web/src/app/layout.tsx`: Fraunces for headings (a serif with editorial/technical
weight, deliberately not another generic SaaS sans), Inter for body copy, and IBM Plex Mono
for every numeric value. The monospace-for-data choice is the single highest-leverage
decision here — CLAUDE.md asks for tabular figures everywhere, and routing every number
through one `DataValue` component (`components/ui/Typography.tsx`) using a monospace face
makes a report read like an instrument's readout rather than a dashboard's stat card,
essentially for free.

**Tokens live in `tailwind.config.ts`** (font families, a named type scale — `display`,
`title`, `subtitle`, `body`, `label`, `caption`, `data`, `data-lg` — and the `dataQuality`
color scale), not scattered as ad hoc Tailwind classes per screen. `components/ui/` holds
the presentational components that consume those tokens (`PageTitle`, `SectionTitle`,
`Label`, `Prose`, `Caption`, `DataValue`, `DataQualityBadge`, `Stepper`, `UploadDropzone`) —
a future screen composes from these rather than reinventing text classes.

**`dataQuality` colors are a certainty gradient, not a judgement.** CLAUDE.md sanctions
exactly one use of colour as a signal: data-quality grades, over/under baseline,
matched/unmatched — never decoration, never green-for-good. `primary`/`modelled`/`default`
map to a deep blue / amber / neutral grey scale (measured fact -> modelled estimate ->
registry default), with no green anywhere in it.

**The example table above the upload box is real, not a marketing screenshot.** It uses the
exact same `DataValue`/`DataQualityBadge` components and table density the real report
uses (Session 6.6 rebuilds the report to match this same system), with numbers explicitly
labelled "Illustrative data — not a live result." What a prospect sees before uploading
anything is honestly what they'll get after.

**The public methodology page (`/methodology`) states current limitations as plainly as the
model.** It's written to convert a prospect, but CLAUDE.md's honesty requirements (no
certification badge Freyo doesn't hold) apply to prose exactly as much as to iconography —
the page has a dedicated section stating that the factor registry isn't populated with
verified official data yet and that Freyo holds no third-party ISO 14083 certification
today, next to the description of the (real, tested) calculation model itself.

**Column-mapping validation is now live**, recomputed via `useMemo` on every mapping change
and shown on the mapping step itself, rather than only surfacing after the user moves past
it to the assumptions step — a "real files are messy" requirement CLAUDE.md already states,
that the original implementation only partially met.

## What this session confirmed, not changed

Steps 2 and 3 of the wizard already existed and worked correctly (Session 6 built them) —
the "unclear whether they're reachable" concern in the companion kickoff's cover note was a
visual-clarity problem (a step list where only the current step read as interactive), not a
functional gap. Verified end-to-end with a synthetic CSV against the real routing engine:
upload -> mapping (live validation) -> assumptions -> report, all three steps rendering
correctly in the new design system.

## Consequences

- Session 6.6 (the report screen rebuild) should compose from `components/ui/` rather than
  reintroduce raw Tailwind text classes — in particular, the existing `ReportView.tsx`'s
  summary "Stat" component (a big number over a small caption, in a rounded grid) is exactly
  the pattern CLAUDE.md's design section forbids as a _primary_ layout, and needs to be
  rebuilt using this session's tokens, not just re-skinned.
- `components/ui/Stepper.tsx` scrolls horizontally rather than clipping when three steps
  don't fit a narrow viewport (found and fixed during this session's own mobile-width
  screenshot check) — any future step added to a flow using this component inherits that
  behavior for free.
- No stray "ETS2 starts in 2027" copy was found anywhere in the repo during this session's
  audit; the existing report copy already correctly says 1 January 2028.
