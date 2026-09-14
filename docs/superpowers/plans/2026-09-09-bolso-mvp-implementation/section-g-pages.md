# Bolso MVP Implementation Plan — Section G: Pages

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

## Section G: Pages

> **Note (2026-09-11):** the swift-spend visual migration already updated
> `src/app/(app)/layout.tsx` to wrap every page below in a
> `mx-auto w-full max-w-lg px-4 pt-6` mobile shell (with `pb-28` to clear the
> now-floating bottom nav). Pages 32-35 should render their content directly
> and not re-wrap in their own `p-4`/full-width container — the sample code
> below predates that shell and its `<main className="p-4">` wrappers should
> be simplified to a bare `<main className="flex flex-col gap-4">` (no
> padding/width of its own).

### Task 32: `/inicio`

**Files:**
- Create: `src/app/(app)/inicio/page.tsx`

**Interfaces:**
- Consumes: `QuickAdd` (Task 26), `ManualExpenseDialog` (Task 27), `OccurrenceList` (Task 28), `OccurrenceSheet` (Task 29), `SummaryTiles`/`useOccurrences`/`apiClient` for summary (Tasks 23-24, 30)
- Produces: the home page — no further tasks consume this directly, it's a leaf.

- [x] **Step 1: Write the page**

Client Component (needs `useSearchParams` for the `focus=quick-add` param and local state for the selected occurrence / manual dialog open state). Structure:

```tsx
'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { QuickAdd } from '@/components/app/quick-add'
import { ManualExpenseDialog } from '@/components/app/manual-expense-dialog'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Button } from '@/components/ui/button'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { formatBRL } from '@/lib/finance/money'
import { toISODate } from '@/lib/finance/date'

export default function InicioPage() {
    const searchParams = useSearchParams()
    const shouldFocus = searchParams.get('focus') === 'quick-add'
    const [manualOpen, setManualOpen] = useState(false)
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    const today = toISODate(new Date())
    const month = today.slice(0, 7)

    const { data: summary } = useQuery({
        queryKey: queryKeys.summary(month),
        queryFn: () => apiClient.get<{ total: number }>(`/api/reports/summary?month=${month}`),
    })

    const { data: todayOccurrences = [] } = useOccurrences({ from: today, to: today })

    return (
        <main className="flex flex-col gap-4 p-4">
            <h1 className="text-2xl font-semibold text-foreground">{summary ? formatBRL(summary.total) : '—'}</h1>
            <QuickAdd autoFocus={shouldFocus} />
            <Button variant="secondary" onClick={() => setManualOpen(true)}>
                Adicionar manualmente
            </Button>
            <h2 className="text-lg font-medium text-foreground">Hoje</h2>
            <OccurrenceList occurrences={todayOccurrences} onSelect={setSelected} />
            <ManualExpenseDialog open={manualOpen} onOpenChange={setManualOpen} />
            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
```

- [ ] **Step 2: Verify manually (golden path + edge case)** (superseded — executed per `2026-09-14-section-g-pages-worktree-plan.md`; static verification (typecheck/lint/test/build) is green, no live browser walk was performed)

```bash
pnpm dev
```

Golden path: land on `/inicio` via the bottom-nav `+`, confirm the quick-add is focused, type an expense, press Enter, confirm it appears under "Hoje" and the total updates. Edge case: with zero expenses ever created, confirm "Hoje" shows the `OccurrenceList` empty state ("Nenhuma despesa encontrada.") instead of crashing.

- [x] **Step 3: Commit**

```bash
git add src/app/\(app\)/inicio
git commit -m "feat: add /inicio page with quick-add and today's expenses"
```

---

### Task 33: `/mes`

**Files:**
- Create: `src/app/(app)/mes/page.tsx`

**Interfaces:**
- Consumes: `MonthSwitcher` (Task 30), `OccurrenceList` (Task 28), `OccurrenceSheet` (Task 29), `useOccurrences` (Task 23), `useCategories`/`useCards` (Tasks 19-20)
- Produces: the month page — leaf.

- [x] **Step 1: Write the page**

Client Component with local state: `month` (default current, via `MonthSwitcher`), `search` (text input, debounced or plain controlled — plain is fine for MVP), `categoryFilter`/`cardFilter`/`typeFilter`/`statusFilter` (shadcn `Select`s populated from `useCategories()`/`useCards()`). Compute `from`/`to` as the first/last day of `month` and pass all filters into `useOccurrences({ from, to, q: search, categoryId: categoryFilter, cardId: cardFilter, status: statusFilter })`. Render `<OccurrenceList occurrences={data} showDateHeaders onSelect={setSelected} />` and `<OccurrenceSheet occurrence={selected} onOpenChange={...} />`.

- [ ] **Step 2: Verify manually (golden path + edge case)** (superseded — see Task 32's note above)

```bash
pnpm dev
```

Golden path: navigate to a month with known expenses (from Task 22's manual testing), confirm they're grouped by date. Edge case: filter by a category with zero matches, confirm the empty state shows instead of a blank screen; navigate to next/previous month via `MonthSwitcher` and confirm the list refetches (check the network tab for a new `/api/occurrences` call with updated `from`/`to`).

- [x] **Step 3: Commit**

```bash
git add src/app/\(app\)/mes
git commit -m "feat: add /mes page with month navigation, search, and filters"
```

---

### Task 34: `/relatorios`

**Files:**
- Create: `src/app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `SummaryTiles` (Task 30), `MonthSwitcher` (Task 30), `useCategories`/`useCards` (Tasks 19-20, to resolve IDs to names), `apiClient`/`queryKeys` for `/api/reports/summary` (Task 24)
- Produces: the reports page — leaf.

- [x] **Step 1: Write the page**

Client Component: `month` state via `MonthSwitcher`, fetch `useQuery({ queryKey: queryKeys.summary(month), queryFn: () => apiClient.get(\`/api/reports/summary?month=${month}\`) })`. Resolve `byCategory`/`byCard` IDs to display names by cross-referencing `useCategories()`/`useCards()` data before passing into `<SummaryTiles>` — build a lookup map (`Object.fromEntries(categories.map(c => [c.id, c.name]))`) and remap the summary's keys, or extend `SummaryTiles` usage inline with a small wrapper that does the remap in this page (keep `SummaryTiles` itself ID-keyed and presentational, per Task 30's note).

- [ ] **Step 2: Verify manually (golden path + edge case)** (superseded — see Task 32's note above)

```bash
pnpm dev
```

Golden path: view the month used in Task 22's testing, confirm totals match what was verified there and category/card names (not raw UUIDs) are shown. Edge case: a month with zero occurrences shows `R$ 0,00` and empty category/card sections without crashing.

- [x] **Step 3: Commit**

```bash
git add src/app/\(app\)/relatorios
git commit -m "feat: add /relatorios page with monthly aggregations"
```

---

### Task 35: `/ajustes` (+ `forms/card-form.tsx` + `forms/category-form.tsx`)

**Files:**
- Create: `src/components/forms/card-form.tsx`
- Create: `src/components/forms/category-form.tsx`
- Create: `src/app/(app)/ajustes/page.tsx`

**Interfaces:**
- Consumes: `createCardSchema`/`createCategorySchema` (Task 18); `useCards`/`useCreateCard`/`useUpdateCard`/`useDeleteCard` (Task 19); `useCategories`/`useCreateCategory`/`useUpdateCategory`/`useDeleteCategory` (Task 20); `CardVisual`/`CardColorPicker` (Task 25); `authClient` from `@/lib/auth-client` (Task 5) for sign-out
- Produces: the settings page — leaf.

- [x] **Step 1: Write `src/components/forms/card-form.tsx`**

RHF + zod form (`zodResolver(createCardSchema)`) with fields: name (text), closing_day/due_day (number 1-31), credit_limit (optional number), color (`CardColorPicker`). Render a live `<CardVisual size="lg" color={watch('color')} name={watch('name')} />` preview above the fields as the user types/picks, per the spec's "seletor de cor com preview" requirement. On submit, call `useCreateCard()` or `useUpdateCard()` depending on whether an `id` prop was passed in.

- [x] **Step 2: Write `src/components/forms/category-form.tsx`**

RHF + zod form (`zodResolver(createCategorySchema)`) with a single `name` text field (icon picker is out of scope for MVP — omit the `icon` field from the form, leave it `null`). Calls `useCreateCategory()`/`useUpdateCategory()`.

- [x] **Step 3: Write `src/app/(app)/ajustes/page.tsx`**

Client Component with three sections: Cards (list via `useCards()`, each rendered with `<CardVisual size="sm">` + edit/delete buttons, plus an "add card" button opening `<CardForm>` in a `Dialog`), Categories (list via `useCategories()` with edit/delete, plus an "add category" button opening `<CategoryForm>` in a `Dialog`), and a "Sair" button calling `authClient.signOut()` then `router.push('/login')`. Theme toggle: a `Switch` reading/writing a `dark` class on `document.documentElement` persisted to `localStorage` (no next-themes dependency needed for MVP's single light/dark toggle).

- [ ] **Step 4: Verify manually (golden path + edge case)** (superseded — see Task 32's note above)

```bash
pnpm dev
```

Golden path: create a card with a chosen color, confirm the `lg` preview updates live before submit and the card appears in the list afterward with the right color. Edge case: try deleting a category that's referenced by an existing occurrence — confirm the FK is `on delete set null` (per the schema defined in Section C) so the delete succeeds and the occurrence's `category_id` becomes null rather than erroring. Toggle the theme switch, reload the page, confirm the choice persisted.

- [x] **Step 5: Commit**

```bash
git add src/components/forms/card-form.tsx src/components/forms/category-form.tsx src/app/\(app\)/ajustes
git commit -m "feat: add /ajustes page with cards/categories CRUD and theme toggle"
```

