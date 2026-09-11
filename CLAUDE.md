# Contai

Mobile-first personal finance manager. Core feature: register an expense
in under 15 seconds via a deterministic (regex, no AI) natural-language
parser. Next.js App Router + PostgreSQL (Drizzle ORM) + Better Auth (with
JWT plugin, email/password only — no Google OAuth in MVP).

## Structure

- `src/app/(auth)/` — login/cadastro pages
- `src/app/(app)/` — authenticated pages (inicio, mes, relatorios, ajustes) behind a session guard
- `src/app/api/` — REST-ish route handlers, see `src/app/api/CLAUDE.md`
- `src/app/api/auth/[...all]/` — Better Auth route handlers
- `src/components/ui/` — shadcn components
- `src/components/app/` — app-specific components (quick-add, occurrence list, card-visual, ...)
- `src/components/forms/` — react-hook-form + zod forms
- `src/hooks/` — React Query hooks
- `src/lib/finance/` — pure domain logic, see `src/lib/finance/CLAUDE.md`
- `src/lib/auth.ts` — Better Auth server instance
- `src/lib/auth-client.ts` — Better Auth client instance
- `src/lib/schemas/` — zod schemas, see `src/lib/schemas/CLAUDE.md`
- `src/providers/` — root-level client providers (`QueryProvider`)
- `src/tests/` — vitest unit tests for the domain layer
- `src/db/` — Drizzle ORM client, schema, and migrations
- `drizzle.config.ts` — Drizzle Kit configuration

## Conventions

- Files: lowercase-with-hyphens. Always named exports (except `page.tsx`/`layout.tsx`/`route.ts`). No barrel files.
- Components: `twMerge('base', className)`, `data-slot="name"`, state via `data-*` attributes, icons sized explicitly, icon-only buttons have `aria-label`.
- No hardcoded colors — only tokens from `globals.css` (`bg-surface`, `text-foreground`, etc).
- Multi-tenant isolation: every query explicitly filters `userId` matching `session.user.id` and `isNull(deletedAt)`.
- All occurrence data (UI + reports) reads `expense_installments`, never `expenses` directly.
- Full design spec: `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`.
