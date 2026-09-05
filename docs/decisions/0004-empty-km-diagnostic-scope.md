# 0004 — Scope and honesty tradeoffs in the empty-kilometre diagnostic

## Context

Kickoff Session 6 asks for the free diagnostic (`apps/web`'s first user-facing flow): upload a
shipment history, route it, compute emissions, infer probable empty return legs, and report
their cost under EU ETS2. Building it honestly surfaced three places where the obvious
implementation would have violated a non-negotiable or invented data that doesn't exist yet
in this codebase.

## Decisions

**Routing uses a real engine, not a placeholder — even without local infrastructure.**
CLAUDE.md non-negotiable #3 (never a straight-line distance, "not even as a placeholder") is
absolute, and `KICKOFF-PROMPT.md`'s own refusal list names this exact shortcut. No self-hosted
OSRM instance exists yet (Docker isn't installed — see
`docs/decisions/0003-routing-client-and-cache-split.md`), so the diagnostic's server action
(`apps/web/src/app/diagnostic/actions.ts`) calls `packages/routing`'s real `createOsrmClient`
against OSRM's public demo server (`router.project-osrm.org`) for local dev, configured via
`apps/web/.env.local`. This is genuine routed road distance, not an approximation — it's just
not production-grade infrastructure (rate-limited, no uptime guarantee, car profile only).
Production deployment must point `ROUTING_ENGINE_URL` at a self-hosted instance instead; the
`.env.local` file says so directly, in the variable named
`osrm-public-demo-DO_NOT_USE_IN_PRODUCTION`.

**Empty-leg CO2e and diesel cost are a separate, simplified estimate — not routed through
`packages/emissions`.** The engine's core formula is mass × distance × intensity, which is
exactly zero whenever mass is zero. That's correct for the audited Ledger (an empty leg
genuinely carries zero tonne-kilometres of cargo) and useless for answering "what does this
empty running cost," since a truck driving empty still burns real diesel. Estimating that
needs a distance/fuel-based method instead:
`empty km × unladen consumption (L/km) × price or WTW factor`. This lives in
`apps/web/src/lib/diagnostic/costs.ts`, entirely separate from `packages/factors`'s audited
registry, and every constant it uses — diesel price, unladen consumption per vehicle
category, the diesel WTW emission factor, and every ETS2 carbon price — is a labeled,
adjustable input with a source note, never a silent hard-coded number. This generalizes
CLAUDE.md's explicit rule for the carbon price ("do not hard-code... it is an input with a
documented default range and a source note") to every other approximation this diagnostic
makes, since none of them are more certain than the carbon price is.

**Geocoding is a small curated gazetteer, not a live geocoding service.** A shipment CSV has
city names, not coordinates, and `packages/routing`'s client needs coordinates.
`apps/web/src/lib/diagnostic/gazetteer.ts` is a static lookup of ~20 major Spanish
city-centre coordinates — public, well-known geographic facts, the same kind already used in
`packages/db/src/seed.ts`. An unresolvable city is reported back as a row-level issue, never
approximated or silently dropped — consistent with "never invent," applied to location data
the same way it applies to emission factors.

**Empty-leg detection is a whole-history, lane-level heuristic, not per-vehicle matching.**
Shipment history alone (no telematics, no per-vehicle GPS — both out of scope per CLAUDE.md)
cannot identify which specific truck ran which specific empty return trip. The heuristic in
`apps/web/src/lib/diagnostic/emptyLegDetection.ts` counts loaded trips in each direction of an
undirected city pair and presumes the deficit direction ran empty for the difference. This is
a documented simplification (stated in that file's own doc comment), not a hidden one — a
future version could add date-proximity matching per vehicle or carrier once that data
exists.

**PDF export is the browser's native print-to-PDF, not a new rendering dependency.**
`ReportView.tsx`'s "Print / Save as PDF" button calls `window.print()` against a dedicated
`@media print` stylesheet (`globals.css`) that hides interactive-only controls. This avoids
adding Puppeteer/Playwright or a PDF-rendering library for what one browser API already does
adequately for a v1 report.

## Consequences

- Every number this diagnostic shows carries an explicit, visible caveat (the amber banner in
  `ReportView.tsx`) that it is a diagnostic estimate, not an audited emissions record — this
  must not be removed or softened without the underlying calculation actually becoming
  audit-grade (a real truck routing profile, a verified factor set, or both).
- If `packages/routing/docker/` ever gets a working local OSRM instance (Docker installed,
  data prepared), point `ROUTING_ENGINE_URL` at it instead of the public demo server for
  anything beyond casual local dev — the public server's rate limits and lack of SLA make it
  unsuitable for repeated use.
- `apps/web`'s TypeScript config uses `moduleResolution: "Bundler"`, unlike every `packages/*`
  workspace's `NodeNext`. Next.js's dev/build bundler could not resolve a `.js`-suffixed
  relative or `@/*`-aliased import to its `.ts` source file (a `Module not found` build
  error) — every import inside `apps/web/src` is extensionless. This is a real constraint of
  this specific bundler setup, discovered by actually running the dev server, not a stylistic
  choice; `packages/*` keeps explicit `.js` extensions since those run under real Node ESM
  resolution (`NodeNext`), where the extension is mandatory.
