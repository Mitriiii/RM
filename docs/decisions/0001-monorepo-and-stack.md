# 0001 — Monorepo and stack

## Context

Freyo has two products that must ship independently but share a non-negotiable core: the
ISO 14083 emissions engine and its unit/type discipline cannot drift between the web app,
the API, and any future integration surface (ERP connectors, eFTI export). The emissions
engine also has much stricter correctness and test requirements than the surrounding CRUD —
it needs to be reviewable and testable in isolation.

## Decision

- **pnpm workspaces monorepo**, `apps/*` for deployables (`web`, `api`), `packages/*` for
  libraries (`shared`, `factors`, `emissions`, `matching`, `routing`, `db`). pnpm over
  npm/yarn for its strict, non-hoisted `node_modules` — it makes an undeclared dependency a
  hard error instead of a latent bug, which matters when `packages/emissions` must stay
  dependency-light and auditable.
- **TypeScript strict mode everywhere**, with `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, and `noPropertyAccessFromIndexSignature` on top of `strict`.
  Emissions software fails silently on type looseness (a `Kilograms` treated as a
  `Kilometres`, an optional field read as present); the stricter compiler settings convert
  more of that class of bug into a compile error.
- **Project references** (`tsconfig.base.json` + per-package `tsconfig.json` with
  `composite: true`) so packages build incrementally and a package cannot accidentally import
  another package's private internals without going through its declared `exports`.
- **Next.js 15 App Router + Tailwind** for `apps/web`, **Fastify** for `apps/api`. Two
  separate deployables rather than one Next.js app with API routes, because the API also
  needs to serve webhooks and eventually eFTI-shaped exchange endpoints that don't belong in
  the web app's deploy lifecycle.
- **Vitest** for unit tests (fast, native ESM, built-in property-based-test-friendly
  `expectTypeOf`/`.test-d.ts` support used for compile-time unit-safety checks). **Playwright**
  reserved for e2e once there is a UI worth driving end-to-end.
- **Drizzle ORM** for `packages/db` — SQL-shaped, not an ActiveRecord-style abstraction, which
  matters for writing row-level-security policies and append-only/hash-chain triggers by hand
  rather than fighting an ORM that assumes mutable rows.
- **Conventional commits**, enforced with a `commit-msg` husky hook running commitlint, so
  history stays scannable and a future changelog can be generated instead of hand-written.

## Consequences

- Every package that crosses a module boundary must depend on `@freyo/shared` for its branded
  unit types rather than passing bare `number`s; this is enforced by convention now and should
  become an ESLint rule once the emissions engine (Session 3) establishes the pattern in
  practice.
- `apps/web` is intentionally excluded from the root TypeScript project-reference build graph
  (`tsconfig.json`) because Next.js manages its own incremental build and type-checking; it
  still references `packages/shared` directly for editor tooling.
- Adding a new package means adding both a `package.json` and a `tsconfig.json` with an
  explicit `references` entry — there is no implicit path resolution across packages.
