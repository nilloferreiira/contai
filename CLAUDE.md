# Contai

Mobile-first personal finance manager. Core feature: register an expense
in under 15 seconds via a deterministic (regex, no AI) natural-language
parser. Turborepo/pnpm monorepo: Next.js App Router (`apps/web`) backed by
shared `packages/domain`, `packages/db`, `packages/api` (Better Auth server
instance plus a tRPC API layer — see
`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-e1-api-trpc.md`).
PostgreSQL (Drizzle ORM) + Better Auth (with JWT plugin, email/password
only — no Google OAuth in MVP).

## Structure

- `apps/web/` — Next.js App Router app (Vercel Root Directory)
  - `src/app/(auth)/` — login/cadastro pages (Server Components exporting per-route `metadata`; the interactive forms are client children in `src/components/forms/`)
  - `src/app/(app)/` — authenticated pages (inicio, mes, relatorios, ajustes) behind a session guard; each route folder has a small `layout.tsx` Server Component exporting per-route `metadata`
  - `src/app/manifest.ts` — PWA manifest via Next's file convention (auto-linked, no manual `<link rel="manifest">` needed)
  - `src/app/api/auth/[...all]/` — re-exports `@contai/api`'s Better Auth instance via `toNextJsHandler`
  - `src/components/ui/` — shadcn components
  - `src/components/app/` — app-specific components (quick-add, occurrence list, card-visual, ...)
  - `src/components/forms/` — react-hook-form + zod forms
  - `src/hooks/` — React Query hooks
  - `src/lib/auth-client.ts` — Better Auth *browser* client instance (web-only)
  - `src/providers/` — root-level client providers (`QueryProvider`)
  - `src/tests/` — vitest tests for web-only concerns (auth client, db connectivity smoke test)
- `packages/domain/` (`@contai/domain`) — pure business logic + zod schemas, zero DB/Next dependency, see `packages/domain/CLAUDE.md`
- `packages/db/` (`@contai/db`) — Drizzle ORM client + schema, see `packages/db/CLAUDE.md`
- `packages/api/` (`@contai/api`) — Better Auth server instance plus a tRPC router layer (six resources: cards, categories, merchants, expenses, occurrences, reports) — see `packages/api/CLAUDE.md`
- `scripts/` — standalone dev scripts (e.g. `db:seed`) run from the repo root, see `scripts/CLAUDE.md`
- `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.base.json` — workspace config

## Conventions

- Files: lowercase-with-hyphens. Always named exports (except `page.tsx`/`layout.tsx`/`route.ts`). Each package's `src/index.ts` is its public entry point — not a forbidden "barrel file".
- Components: `twMerge('base', className)`, `data-slot="name"`, state via `data-*` attributes, icons sized explicitly, icon-only buttons have `aria-label`.
- No hardcoded colors — only tokens from `apps/web/src/app/globals.css` (`bg-surface`, `text-foreground`, etc).
- Multi-tenant isolation: every query explicitly filters `userId` matching the authenticated user's id and `isNull(deletedAt)`.
- All occurrence data (UI + reports) reads `expense_installments`, never `expenses` directly.
- Full design spec: `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`.
- Monorepo/tRPC migration design: `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`.
- Visual/style system (colors, radius, fonts, mobile shell) is sourced from the
  `swift-spend` MVP for parity: OKLCH forest-green/lime palette, Figtree
  (sans) + Fraunces (display), `1rem` base radius, `max-w-lg` centered mobile
  shell with a floating-FAB bottom nav.
