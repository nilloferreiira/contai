# Bolso MVP Implementation Plan — Section H: Polish

> Part of the full plan. Master checklist and progress tracking: `../2026-09-09-bolso-mvp-implementation.md`. Shared context below is duplicated from that file so this section can be worked on standalone.

**Goal:** Build the Bolso MVP — a mobile-first personal finance manager where a user registers an expense in under 15 seconds via a deterministic natural-language parser, backed by Next.js + PostgreSQL + Drizzle ORM + Better Auth (JWT).

**Architecture:** Next.js App Router with Server Components by default; PostgreSQL via Drizzle ORM; Better Auth (JWT plugin with signed stateless cookies) for authentication; a DB-free pure domain layer (`src/lib/finance/`) handling invoice/installment/recurrence/parser math, unit-tested with vitest; thin API routes (`auth → zod → execute → JSON`) that call the domain layer and Drizzle ORM; React Query on the client for cache/mutations; shadcn/ui + tailwind-variants for components.

**Tech Stack:** Next.js 16+ (TS strict), pnpm, shadcn/ui, PostgreSQL (`postgres` driver), Drizzle ORM (`drizzle-orm`, `drizzle-kit`), Better Auth (`better-auth` with JWT plugin, `@better-auth/cli`), `@tanstack/react-query` v5, zod, react-hook-form, Tailwind v4, tailwind-variants, tailwind-merge, lucide-react, sonner, date-fns, vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`

## Global Constraints

- Files: lowercase-with-hyphens (`user-card.tsx`, `use-modal.ts`).
- Always named exports, never `export default` — except `page.tsx`, `layout.tsx`, and `route.ts` handlers (`GET`/`POST`/`PATCH`/`DELETE`), which Next.js requires.
- No barrel files (`index.ts`) for internal folders (except `src/db/schema/index.ts` for Drizzle schema re-exports).
- Every UI component: `className={twMerge('base-classes', className)}`, `data-slot="<name>"` on the root element, state via `data-disabled={disabled ? '' : undefined}` (not boolean className logic), `{...props}` spread last, icon-only buttons need `aria-label`, icons use explicit `size-*` classes.
- No hardcoded colors (`text-white`, `bg-[#hex]`) — only the tokens in `globals.css` (`bg-surface`, `text-foreground`, `border-border`, etc.).
- TypeScript: never `React.FC`, never `any`; type-only imports (`import type { ComponentProps } from 'react'`); component props extend `ComponentProps<'tag'>` (+ `VariantProps<typeof xVariants>` when the component has variants).
- Every API route under `src/app/api/*`: call `auth.api.getSession({ headers: await headers() })` and return `401` if no user, `safeParse` the body with a zod schema and return `422` with `error.flatten()` on failure — never trust a client-supplied `userId`. All DB queries must explicitly scope by user ID and `isNull(table.deletedAt)`.
- `expense_installments` (occurrences) is what all UI/reports read — never `expenses` directly.
- Installments anchor to **purchase month + i**, never to the due date. Recurrence compares **calendar dates** (`toISODate`), inclusive of the start day.
- Google OAuth is out of scope — email/password only.
- End of every task below: if it's the first task to create a structurally complex folder (`src/lib/finance/`, `src/db/`, `src/lib/auth/`, `src/lib/schemas/`, `src/app/api/`), add a short `CLAUDE.md` in that folder stating its purpose/patterns. Always also refresh the root `CLAUDE.md` with what that task added to the project structure.

---

## Section H: Polish

### Task 36: Loading/empty/error states + accessibility audit

**Files:**
- Modify: `src/components/app/occurrence-list.tsx` (loading/error variants)
- Modify: `src/app/(app)/inicio/page.tsx`, `src/app/(app)/mes/page.tsx`, `src/app/(app)/relatorios/page.tsx`, `src/app/(app)/ajustes/page.tsx` (loading/error rendering)
- Create: `src/components/ui/skeleton-list.tsx` (small shared skeleton block if not already covered by shadcn's `Skeleton`)

**Interfaces:**
- Consumes: `Skeleton` from shadcn (Task 2); `isLoading`/`isError` flags already returned by every `useQuery` hook from Sections E
- Produces: nothing new consumed later — this is the last content task before the final quality pass.

- [ ] **Step 1: Add loading skeletons**

In each of the four pages, destructure `isLoading` from the relevant `useQuery`/`useOccurrences`/etc. call and render 3-4 `<Skeleton className="h-11 w-full rounded-lg" />` rows in place of the list/tiles while `isLoading` is true.

- [ ] **Step 2: Add error states**

Destructure `isError` and render a short inline message (`"Não foi possível carregar. Tente novamente."`) with a `Button` that calls the query's `refetch()`.

- [ ] **Step 3: Accessibility pass**

Grep the codebase for icon-only interactive elements missing `aria-label`:

```bash
grep -rn "className=\"[^\"]*size-" src/components src/app | grep -B2 "onClick\|<button" | grep -L "aria-label"
```

Manually inspect each match (the grep is a starting point, not exhaustive) and add `aria-label` where missing. Confirm every interactive element (`button`, `a`, form controls) has `min-h-11 min-w-11` or equivalent 44px touch target via Tailwind's `size-11`/`min-h-11` utilities, and that focus-visible rings (`focus-visible:ring-2 focus-visible:ring-ring`) are present on every custom interactive element (shadcn components already have this).

- [ ] **Step 4: Verify**

```bash
pnpm dev
```

Tab through `/inicio`, `/mes`, `/relatorios`, `/ajustes` using only the keyboard — confirm every interactive element is reachable and shows a visible focus ring. Throttle network to "Slow 3G" in devtools and reload each page — confirm skeletons show before content.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: add loading/error states and accessibility touch-ups across pages"
```

---

### Task 37: Metadata, PWA basics, final quality pass

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/cadastro/page.tsx`, `src/app/(app)/inicio/page.tsx`, `src/app/(app)/mes/page.tsx`, `src/app/(app)/relatorios/page.tsx`, `src/app/(app)/ajustes/page.tsx` (add `export const metadata`)
- Create: `public/manifest.webmanifest`
- Modify: `src/app/layout.tsx` (link the manifest)
- Modify: root `CLAUDE.md` (final structure overview)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Add per-page metadata**

Since these pages are Client Components (`'use client'`), add a sibling `export const metadata = { title: '...', description: '...' }` is not valid in a client file — instead, for each of the 6 pages, keep the page itself as the client component and move metadata to a `layout.tsx` in the same route segment if one doesn't already exist, or convert the page to export metadata from a co-located server wrapper only if needed. Simplest MVP-correct approach: add `export const metadata: Metadata = { title: 'Bolso — Início', description: '...' }` to `src/app/(app)/layout.tsx` and `src/app/(auth)/login/page.tsx`/`cadastro/page.tsx` if those two remain Server Components (they can be — only the form needs `'use client'`, which should be a child component, not the page itself; if Task 7 made the whole page a client component, split out a small `<LoginForm />`/`<CadastroForm />` client child now so the page file itself can stay a Server Component and export `metadata`).

- [ ] **Step 2: Write `public/manifest.webmanifest`**

```json
{
  "name": "Bolso",
  "short_name": "Bolso",
  "start_url": "/inicio",
  "display": "standalone",
  "background_color": "#FDF9F3",
  "theme_color": "#D97B33",
  "icons": []
}
```

Link it in `src/app/layout.tsx`'s `<head>` via `<link rel="manifest" href="/manifest.webmanifest" />` (or the `metadata.manifest` field if using the App Router `Metadata` API).

- [ ] **Step 3: Final root `CLAUDE.md` update**

Re-read the full `src/` tree (`find src -type f | sort`) and update the "Structure" section of root `CLAUDE.md` to match reality exactly — remove anything planned-but-unbuilt, add anything built that wasn't in the original list.

- [ ] **Step 4: Run the full quality gate**

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm drizzle-kit check
```

Expected: all clean. Fix any failures before proceeding — do not skip or suppress.

- [ ] **Step 5: Full manual walkthrough**

```bash
pnpm dev
```

Sign up with a new email → confirm redirected/prompted appropriately → log in → add an expense via quick-add → see it on `/inicio` and `/mes` → check `/relatorios` totals match → go to `/ajustes`, edit a card's color, confirm it's reflected everywhere the card appears → sign out → confirm redirected to `/login` and `/inicio` is no longer reachable without logging in again.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add page metadata, PWA manifest, and final CLAUDE.md update"
```

