# Bolso MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. The plan is split into one file per section under `2026-09-09-bolso-mvp-implementation/` — each section file is self-contained (it repeats the shared context below) and keeps the original per-step checkbox (`- [ ]`) tracking. This file is the master checklist: check off a section below once every step in its file is done.

**Goal:** Build the Bolso MVP — a mobile-first personal finance manager where a user registers an expense in under 15 seconds via a deterministic natural-language parser, backed by Next.js, PostgreSQL, Drizzle ORM, and Better Auth.

**Architecture:** Next.js App Router with Server Components by default; PostgreSQL for persistence via Drizzle ORM (using `postgres.js`); Better Auth with JWT plugin for session management and token verification (JWKS-backed session cookie cache); a DB-free pure domain layer (`src/lib/finance/`) handling invoice/installment/recurrence/parser math, unit-tested with vitest; thin API routes (`auth → zod → execute → JSON`) that call the domain layer and Drizzle ORM; React Query on the client for cache/mutations; shadcn/ui + tailwind-variants for components.

**Tech Stack:** Next.js 16+ (TS strict), pnpm, shadcn/ui, Better Auth (`better-auth`), Drizzle ORM (`drizzle-orm`, `drizzle-kit`), PostgreSQL driver (`postgres`), `@tanstack/react-query` v5, zod, react-hook-form, Tailwind v4, tailwind-variants, tailwind-merge, lucide-react, sonner, date-fns, vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`

## Global Constraints

- Files: lowercase-with-hyphens (`user-card.tsx`, `use-modal.ts`).
- Always named exports, never `export default` — except `page.tsx`, `layout.tsx`, and `route.ts` handlers (`GET`/`POST`/`PATCH`/`DELETE`), which Next.js requires.
- No barrel files (`index.ts`) for internal folders (except `src/db/schema/index.ts` where Drizzle collects tables/relations).
- Every UI component: `className={twMerge('base-classes', className)}`, `data-slot="<name>"` on the root element, state via `data-disabled={disabled ? '' : undefined}` (not boolean className logic), `{...props}` spread last, icon-only buttons need `aria-label`, icons use explicit `size-*` classes.
- No hardcoded colors (`text-white`, `bg-[#hex]`) — only the tokens in `globals.css` (`bg-surface`, `text-foreground`, `border-border`, etc.).
- TypeScript: never `React.FC`, never `any`; type-only imports (`import type { ComponentProps } from 'react'`); component props extend `ComponentProps<'tag'>` (+ `VariantProps<typeof xVariants>` when the component has variants).
- Every API route under `src/app/api/*`: authenticate via Better Auth (`const session = await auth.api.getSession({ headers: await headers() })`) and return `401` if no user, `safeParse` the body with a zod schema and return `422` with `error.flatten()` on failure — never trust a client-supplied `user_id`. Always query using `session.user.id`.
- Multi-tenant isolation and soft-deletes: Every query against user-owned tables (`cards`, `categories`, `merchants`, `recurrences`, `expenses`, `installment_plans`, `expense_installments`) must filter by `eq(table.userId, session.user.id)` and `isNull(table.deletedAt)`. A delete is always an update setting `deletedAt = new Date()`.
- `expense_installments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/db/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

---

## Progress Checklist

Each row links to that section's full file (tasks, files, interfaces, step-by-step checkboxes). Check a section off here only once every step inside its file is checked off.

- [x] **Section A: Foundation** (Tasks 1-4) — `2026-09-09-bolso-mvp-implementation/section-a-foundation.md`
  Dependencies (Drizzle, Better Auth, Postgres, Tailwind, shadcn), ESLint rules, root CLAUDE.md, shadcn/ui init + tokens/fonts, QueryProvider + Toaster, vitest setup.
- [x] **Section B: PostgreSQL & Better Auth** (Tasks 5-8) — `2026-09-09-bolso-mvp-implementation/section-b-better-auth.md`
  PostgreSQL connection + Drizzle instance, Better Auth server + JWT plugin + client, Next.js 16 proxy optimistic guard, `/login` + `/cadastro`, authenticated route guard + bottom nav shell.
- [x] **Section C: Database** (Task 9) — `2026-09-09-bolso-mvp-implementation/section-c-database.md`
  Drizzle ORM schema (`src/db/schema/*`), enums, relations, indexes, and Drizzle Kit migration workflow (`drizzle.config.ts`, `pnpm drizzle-kit push`/`generate`).
- [x] **Section D: Domain layer** (Tasks 10-17) — `2026-09-09-bolso-mvp-implementation/section-d-domain-layer.md`
  `src/lib/finance/`: date/money, invoice, installments, recurrence, merchants, parser (2 parts), dashboard — all pure, unit-tested.
- [x] **Section E1: API (tRPC + services)** (Tasks 18-24) — `2026-09-09-bolso-mvp-implementation/section-e1-api-trpc.md`
  `packages/api` tRPC infra, a services layer (`packages/api/src/services/`) doing the actual DB/domain orchestration, and thin `cards`/`categories`/`merchants`/`expenses`/`occurrences`/`reports` routers as `protectedProcedure`s.
- [x] **Section E2: Web hooks** (Tasks 18-24) — `2026-09-09-bolso-mvp-implementation/section-e2-web-hooks.md`
  tRPC client wiring (`apps/web/src/lib/trpc/`) and matching React Query hooks (`use-cards.ts`, `use-categories.ts`, `use-merchants.ts`, `use-create-expense.ts`, `use-occurrences.ts`, `use-summary.ts`) via `@trpc/tanstack-react-query`. Depends on E1's routers existing for its "Verify manually" steps.

  E1/E2 together supersede the REST version previously at `section-e-api-hooks.md` and the combined tRPC doc previously at `section-e-api-trpc.md` — both never built, both deleted (see git history).
- [x] **Section F: UI components** (Tasks 25-31) — `2026-09-09-bolso-mvp-implementation/section-f-ui-components.md`
  Card visual/colors, quick-add, manual expense dialog + form, occurrence list/row, occurrence sheet, summary tiles + month switcher. Built per `2026-09-14-section-f-ui-components-worktree-plan.md` (a rewrite against post-tRPC-migration source); bottom-nav's `?focus=quick-add` autofocus wiring and all manual/live verification are deferred to Section G (Task 32+), since no app routes exist yet.
- [ ] **Section G: Pages** (Tasks 32-35) — `2026-09-09-bolso-mvp-implementation/section-g-pages.md`
  `/inicio`, `/mes`, `/relatorios`, `/ajustes` (+ card/category forms, Better Auth sign-out).
- [ ] **Section H: Polish** (Tasks 36-37) — `2026-09-09-bolso-mvp-implementation/section-h-polish.md`
  Loading/empty/error states + accessibility audit, metadata/PWA basics + final quality pass.

---

## Self-Review

**Spec coverage:** every numbered section of the design spec maps to at least one task — stack/setup → Task 1-4; naming/component rules → Global Constraints (enforced throughout); color tokens → Task 2; file tree → realized progressively across all tasks; data model → Task 9 (Drizzle schema); domain layer (invoice/installments/recurrence/parser/merchants/dashboard) → Tasks 10-17; Better Auth server/client/guard → Tasks 5,6,8; API contract → Tasks 19-24; idempotent category seed → Task 20; forms/password checklist → Tasks 7,27,35; React Query → Task 18 (`query-keys.ts`) + every hook task; pages → Tasks 32-35; card-visual → Task 25; checklist section 13 → covered end-to-end; out-of-scope list → honored (no Open Finance/AI/bank integration/investments/multi-user/payments/Google OAuth anywhere in the plan).

**Placeholder scan:** no TBD/TODO; every code step has real, complete code; no "similar to Task N" cross-references without inline code.

**Type consistency:** `OccurrenceRow` (Task 23) is the single shared name for occurrence rows, reused identically in Tasks 28, 29, 32, 33 rather than redefined. `CreateExpenseInput`/`CreateCardInput`/`CreateCategoryInput` (Task 18) are the single source for those shapes, reused in Tasks 19, 20, 22, 26, 27, 35. `CardCycle` (Task 11) is reused unchanged through Tasks 12 and 22. Drizzle schema tables export `$inferSelect` and `$inferInsert` types.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`, split by section into `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task (or per section file), review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
