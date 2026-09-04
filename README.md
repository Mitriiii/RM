# Freyo

Audit-grade ISO 14083 emissions measurement and pooled backhaul matching for European road
freight. See [`CLAUDE.md`](./CLAUDE.md) for the full product and engineering brief, and
[`docs/FREYO-Concept-v2.md`](./docs/FREYO-Concept-v2.md) for the strategy behind it.

## Layout

```
apps/
  web/          Next.js 15 App Router, TypeScript, Tailwind
  api/          Fastify
packages/
  shared/       branded unit types, zod schemas, domain types
  factors/      versioned emission-factor registry
  emissions/    ISO 14083 engine (pure, no I/O)
  matching/     deterministic constraint solver + explainable scorer
  routing/      routed road distance client + cache
  db/           Drizzle schema, migrations, RLS policies
docs/
  decisions/    one ADR per architectural decision
```

## Getting started

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
```

Copy `.env.example` to `.env` and fill in real values before running `apps/api` or anything
in `packages/db` or `packages/routing`.

## Build order

This repo is being built session by session against `KICKOFF-PROMPT.md`. Most packages above
are currently structural placeholders — see each `src/index.ts` for which kickoff session
fills it in.
