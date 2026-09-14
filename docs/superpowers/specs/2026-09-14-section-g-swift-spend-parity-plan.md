# Section G — swift-spend Layout/UX Parity Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/inicio`, `/mes`, `/relatorios`, `/ajustes` (built per
`2026-09-14-section-g-pages-worktree-plan.md`, already merged into this
branch and reviewed) up to UI/UX parity with the reference implementation at
`../swift-spend/src/routes/_authenticated/{inicio,mes,relatorios,ajustes}.tsx`
— **layout and interaction parity only, using data our existing tRPC
procedures already expose.** No new tRPC procedures, no DB schema changes.
This is a follow-up scope decided after the original Section G branch was
already implemented and reviewed; it continues on the same branch
(`feature/g-pages`) rather than opening a new worktree.

**Why this is feasible without backend changes:** `occurrences.list`
(`packages/api/src/services/occurrences-service.ts`'s `listOccurrences`)
does `db.select().from(expenseInstallments)` — an unprojected full-row
select. Every field swift-spend's richer pages need
(`recurrenceId`/`installmentsTotal`/`installmentNumber`/`dueDate`/
`occurrenceDate`/`status`/`amount`/`categoryId`/`cardId`) is already
returned to the client via `OccurrenceRow` (`apps/web/src/hooks/use-occurrences.ts`).
Separately, recurring expenses are **materialized 12 months ahead at
creation time** (`packages/api/src/services/expenses-service.ts`, the
`recurring` branch of `createExpense` — `untilDate.setMonth(... + 12)`),
so "upcoming invoices" and "next 3 months" forecasting need no virtual
projection engine (swift-spend's `projectRecurrences`/`mergeProjected` in
`forecast.ts` solve a problem we don't have — **do not port those two
functions**) — a plain `occurrences.list` call with a future `from` and
`status: 'pending'` already returns real, persisted future rows.

**What's explicitly excluded from this pass** (would need new backend
work, and the earlier scoping conversation confirmed only UI/layout parity
using existing data is in scope):
- Per-page `<title>`/meta tags (swift-spend's `head()`). Next.js App
  Router's equivalent (`export const metadata`) can only be exported from
  a Server Component, and all four pages are locked as `'use client'` per
  `2026-09-14-section-g-pages-worktree-plan.md`'s "Architecture decision"
  (not re-litigated here) — adding metadata would require a server/client
  page split that decision explicitly rejected. Skip.
- `projectRecurrences`/`mergeProjected`/virtual forecast rows — not needed
  (see above), don't port them.

## Global Constraints

(Same as `2026-09-14-section-g-pages-worktree-plan.md` — repeated for
standalone reading.)

- Files: lowercase-with-hyphens. Always named exports, never `export
  default` except `page.tsx`.
- Every UI component: `className={twMerge('base-classes', className)}`,
  `data-slot="<name>"` on the root element, icon-only buttons need
  `aria-label`, icons use explicit `size-*` classes.
- No hardcoded colors — only tokens from `apps/web/src/app/globals.css`.
- TypeScript: never `React.FC`, never `any`; type-only imports; props
  extend `ComponentProps<'tag'>` where relevant.
- Never redeclare a zod schema that already exists — import from
  `@contai/domain`.
- A caller-supplied or generated `Date` must go through `@contai/domain`'s
  `toISODate`/`fromISODate`/`monthKey` — never a bare
  `Date`/`.toISOString()`/`new Date(str)`.
- `packages/domain` stays pure: zero DB/Next/`@contai/api` dependency. New
  functions there take plain data (arrays of plain objects), never
  Drizzle/tRPC types.
- Run `pnpm --filter web typecheck` after every web task, and
  `pnpm turbo run typecheck` after the domain task. Must be green before
  the next task starts.
- Multi-tenant isolation, soft-delete filtering: unaffected by this plan —
  no service-layer files change.

---

### Task 1 (R1): `@contai/domain` — month label + reporting/forecast pure functions

**Files:**
- Edit: `packages/domain/src/date.ts`
- Edit: `packages/domain/src/dashboard.ts`
- Edit: `packages/domain/tests/dashboard.test.ts` (extend with new cases)

**Port from (read for logic reference, adapt field names — see table
below):** `../swift-spend/src/lib/finance/date.ts` (`monthLabel`,
`formatDayMonth`), `../swift-spend/src/lib/finance/dashboard.ts`
(`byCategory`, `byCard`, `upcomingInvoices`, `monthlyForecast`),
`../swift-spend/src/lib/finance/forecast.ts` (`isForecast`,
`splitRealizedForecast` only — **not** `projectRecurrences`/
`mergeProjected`/`forecastId`).

**Field-name translation** (swift-spend's `Occurrence` is snake_case
matching its Supabase row shape; our domain's existing `Occurrence`
interface in `dashboard.ts` is ALSO snake_case — a deliberate existing
convention decoupling domain math from Drizzle's camelCase — extend it,
don't replace it):

| swift-spend field | our domain field (extend existing `Occurrence`) |
|---|---|
| `category_id` | `category_id` (already present) |
| `card_id` | `card_id` (already present) |
| `recurrence_id` | `recurrence_id` (add, `string \| null`) |
| `installments_total` | `installments_total` (add, `number \| null`) |
| `occurrence_date` | `occurrence_date` (add, `string`, ISO date) |
| `due_date` | `due_date` (add, `string`, ISO date) |
| `amount` | `amount` (already present, `number`) |
| `status` | `status` (already present) |

**Step 1: `date.ts` — add `monthLabel`**

```ts
const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function monthLabel(date: Date): string {
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}
```

(Matches `../swift-spend/src/lib/finance/date.ts`'s `MONTHS`/`monthLabel`
exactly — this is pure copy, no field-name translation needed since it
takes a `Date`.)

**Step 2: `dashboard.ts` — extend `Occurrence`, add new functions**

Extend the existing interface (do not remove/rename any existing field —
`summarizeMonth` and its caller `packages/api/src/services/reports-service.ts`
depend on the current shape and must keep working unchanged):

```ts
export interface Occurrence {
    amount: number
    category_id: string | null
    card_id: string | null
    status: 'pending' | 'paid' | 'cancelled'
    recurrence_id?: string | null
    installments_total?: number | null
    occurrence_date?: string
    due_date?: string
}
```

Add, alongside the existing `summarizeMonth` (don't touch it):

```ts
export function isForecast(occurrence: Occurrence, today: Date = new Date()): boolean {
    if (!occurrence.occurrence_date) return false
    return occurrence.occurrence_date > toISODate(today)
}

export interface RealizedForecastSplit {
    realized: number
    forecast: number
    total: number
}

export function splitRealizedForecast(occurrences: Occurrence[], today: Date = new Date()): RealizedForecastSplit {
    let realized = 0
    let forecast = 0
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        if (isForecast(o, today)) forecast += o.amount
        else realized += o.amount
    }
    return { realized, forecast, total: realized + forecast }
}

export interface TypeBreakdown {
    invoicesTotal: number
    recurringTotal: number
    installmentsTotal: number
}

export function breakdownByType(occurrences: Occurrence[]): TypeBreakdown {
    let invoicesTotal = 0
    let recurringTotal = 0
    let installmentsTotal = 0
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        if (o.card_id) invoicesTotal += o.amount
        if (o.recurrence_id) recurringTotal += o.amount
        if (o.installments_total && o.installments_total > 1) installmentsTotal += o.amount
    }
    return { invoicesTotal, recurringTotal, installmentsTotal }
}

export interface AmountSlice {
    id: string
    total: number
}

export function byCategoryTotals(occurrences: Occurrence[]): AmountSlice[] {
    const map = new Map<string, number>()
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        const key = o.category_id ?? 'none'
        map.set(key, (map.get(key) ?? 0) + o.amount)
    }
    return [...map.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)
}

export function byCardTotals(occurrences: Occurrence[]): AmountSlice[] {
    const map = new Map<string, number>()
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        const key = o.card_id ?? 'none'
        map.set(key, (map.get(key) ?? 0) + o.amount)
    }
    return [...map.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)
}

export interface UpcomingInvoice {
    cardId: string
    total: number
    realizedTotal: number
    forecastTotal: number
    dueDate: string
}

export function upcomingInvoices(occurrences: Occurrence[], from: Date, today: Date = new Date()): UpcomingInvoice[] {
    const fromISO = toISODate(from)
    const map = new Map<string, { total: number; realized: number; forecast: number; dueDate: string }>()
    for (const o of occurrences) {
        if (!o.card_id || o.status !== 'pending' || !o.due_date || !o.occurrence_date) continue
        if (o.due_date < fromISO) continue
        const monthOfDue = o.due_date.slice(0, 7)
        const key = `${o.card_id}|${monthOfDue}`
        const entry = map.get(key) ?? { total: 0, realized: 0, forecast: 0, dueDate: o.due_date }
        entry.total += o.amount
        if (isForecast(o, today)) entry.forecast += o.amount
        else entry.realized += o.amount
        if (o.due_date < entry.dueDate) entry.dueDate = o.due_date
        map.set(key, entry)
    }
    return [...map.entries()]
        .map(([key, value]) => ({
            cardId: key.split('|')[0] ?? '',
            total: value.total,
            realizedTotal: value.realized,
            forecastTotal: value.forecast,
            dueDate: value.dueDate,
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export interface MonthForecast {
    key: string
    total: number
}

export function monthlyForecast(occurrences: Occurrence[], from: Date, months: number): MonthForecast[] {
    const keys: string[] = []
    for (let i = 0; i < months; i++) {
        keys.push(monthKey(new Date(from.getFullYear(), from.getMonth() + i, 1)))
    }
    const totals = new Map<string, number>(keys.map((k) => [k, 0]))
    for (const o of occurrences) {
        if (o.status === 'cancelled' || !o.occurrence_date) continue
        const key = o.occurrence_date.slice(0, 7)
        if (!totals.has(key)) continue
        totals.set(key, (totals.get(key) ?? 0) + o.amount)
    }
    return keys.map((key) => ({ key, total: totals.get(key) ?? 0 }))
}
```

Notes vs. the swift-spend source:
- `upcomingInvoices`/`byCategoryTotals`/`byCardTotals` return bare
  `{id, total}`/`{cardId, ...}` shapes with **no name/icon/color
  resolution** — that stays a page-level concern (`Record<string,string>`
  lookup maps), mirroring the already-reviewed `remapByName` pattern in
  `apps/web/src/app/(app)/relatorios/page.tsx` rather than swift-spend's
  `Card[]`/`Category[]` param style. Do not import `@contai/api`'s
  `Card`/`Category` row types into `@contai/domain` to do this lookup
  inside the domain layer — that would violate the package's zero-DB-type
  boundary.
- `monthKey` is already imported in `dashboard.ts`'s file scope or needs
  importing from `./date` — check the existing top of the file.
- `toISODate` similarly needs importing from `./date` if not already.

**Step 3: Tests**

Add test cases to `packages/domain/tests/dashboard.test.ts` for each new
function (a handful of representative cases each — cancelled-exclusion,
empty-input, and the main happy path is sufficient; don't over-test). Also
add a `monthLabel` case to `packages/domain/tests/date.test.ts`.

**Step 4: Verify**

```bash
pnpm turbo run typecheck test --filter=@contai/domain
```

Must be green — this is the only task that touches a package other than
`apps/web`, and it has no manual-verify step (pure functions, fully
covered by unit tests).

**Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat: add reporting/forecast pure functions to @contai/domain"
```

---

### Task 2 (R2): shared `OccurrenceListSkeleton` component

**Files:**
- Create: `apps/web/src/components/app/occurrence-list-skeleton.tsx`

**Why:** `/inicio`, `/mes`, and `/relatorios`'s drill-down list all need a
loading placeholder shaped like `OccurrenceList`'s output. One shared
component avoids three near-identical inline blocks (matches
`../swift-spend/src/components/app/OccurrenceList.tsx`'s exported
`OccurrenceListSkeleton`, adapted to this codebase's `Skeleton` primitive
at `apps/web/src/components/ui/skeleton.tsx`).

**Step 1: Write the component**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export interface OccurrenceListSkeletonProps {
    rows?: number
    showDateHeaders?: boolean
}

export function OccurrenceListSkeleton({ rows = 3, showDateHeaders = false }: OccurrenceListSkeletonProps) {
    return (
        <div data-slot="occurrence-list-skeleton" className="flex flex-col gap-1">
            {showDateHeaders && <Skeleton className="mb-1 h-3 w-16" />}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex min-h-11 items-center justify-between rounded-2xl px-3 py-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                </div>
            ))}
        </div>
    )
}
```

**Step 2: Verify**

```bash
pnpm --filter web typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/components/app/occurrence-list-skeleton.tsx
git commit -m "feat: add shared OccurrenceListSkeleton loading placeholder"
```

---

### Task 3 (R3): `/inicio` rework

**Files:**
- Edit: `apps/web/src/app/(app)/inicio/page.tsx`

**Depends on:** R1 (`monthLabel`), R2 (`OccurrenceListSkeleton`).

**Changes vs. current implementation:**
1. Add a "Gastos no mês" label styled `text-sm font-medium
   text-muted-foreground` above the total, and format the month above that
   via `monthLabel(new Date())` — matching
   `../swift-spend/src/routes/_authenticated/inicio.tsx`'s header
   structure (`<p>{monthLabel}</p>` → `<h1>Gastos no mês</h1>` → big
   number). Keep the existing `formatBRL(summary.total)` value and
   `font-display text-2xl` sizing already in place (swift-spend uses
   `text-4xl` — use your judgment on size, `text-2xl`–`text-4xl` are both
   reasonable for this shell's `max-w-lg` width; don't blindly copy a size
   that overflows on a 400px viewport).
2. Show `<Skeleton>` in place of the total while `useSummary` has no data
   yet (destructure `isLoading` from `useSummary`).
3. Show `<OccurrenceListSkeleton rows={3} showDateHeaders={false}>` in
   place of `<OccurrenceList>` while `useOccurrences` has no data yet.
4. Keep everything else (QuickAdd, ManualExpenseDialog, OccurrenceSheet,
   the `isError` message added by the earlier final-review fix) unchanged
   — do not regress the I5 error-state fix or the I7 FAB-focus fix already
   in this branch.

**Step 1: Edit the page**

**Step 2: Verify manually**

```bash
pnpm --filter web typecheck
```

Golden path: skeleton shows briefly on load, then the real total/list
render; "Gastos no mês" label reads correctly above the total.

**Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/inicio"
git commit -m "feat: add loading skeletons and month-total label to /inicio"
```

---

### Task 4 (R4): `/mes` rework

**Files:**
- Edit: `apps/web/src/app/(app)/mes/page.tsx`
- Edit: `apps/web/src/components/app/month-switcher.tsx`

**Depends on:** R1 (`monthLabel`, `splitRealizedForecast`), R2
(`OccurrenceListSkeleton`).

**Changes vs. current implementation:**
1. `month-switcher.tsx`: format the displayed label via
   `monthLabel(fromISODate(\`${month}-01\`))` instead of the raw `month`
   string (`"2026-09"` → `"setembro 2026"`). Keep the component's public
   prop contract (`month: string` in `"YYYY-MM"`, `onChange`) unchanged —
   this is an internal display-only change.
2. Add a month-total display beneath the switcher header, matching
   `../swift-spend/src/routes/_authenticated/mes.tsx`'s header: total via
   `splitRealizedForecast(occurrences).total`, and when
   `split.forecast > 0`, a secondary line
   `"{formatBRL(split.realized)} realizado · {formatBRL(split.forecast)} previsto"`
   styled `text-xs text-muted-foreground`. Show a `<Skeleton>` here while
   `useOccurrences` is loading.
3. Add a fourth filter: "Tipo" (single/installment/recorrente) —
   **client-side only**, filtering the already-fetched `occurrences` array
   further in memory (no new query param — `occurrenceFiltersSchema` has
   no `type` field, do not add one to the tRPC call). Add a `type` local
   state (`'all' | 'single' | 'installment' | 'recurring'`, sentinel
   pattern matching the existing category/card/status selects' `?? 'all'`
   convention already in this file) and a `useMemo`-derived `filtered`
   array applying: `type === 'installment'` →
   `(o.installmentsTotal ?? 0) > 1`; `type === 'recurring'` →
   `o.recurrenceId != null`; `type === 'single'` → neither of the above.
   Pass `filtered` (not the raw `occurrences`) to `<OccurrenceList>`.
4. Add `<OccurrenceListSkeleton rows={6}>` while loading, and keep the
   existing `isError` message from the earlier final-review fix.

**Step 1: Edit `month-switcher.tsx`**

**Step 2: Edit `mes/page.tsx`**

**Step 3: Verify manually**

```bash
pnpm --filter web typecheck
```

Golden path: month label reads in Portuguese ("setembro 2026", not
"2026-09"); total + realized/previsto split shows; "Tipo" filter narrows
the list correctly for a card/expense with installments or a recurring
expense.

**Step 4: Commit**

```bash
git add apps/web/src/components/app/month-switcher.tsx "apps/web/src/app/(app)/mes"
git commit -m "feat: add month total, type filter, and skeletons to /mes"
```

---

### Task 5 (R5): `/relatorios` rework

**Files:**
- Edit: `apps/web/src/app/(app)/relatorios/page.tsx`

**Depends on:** R1 (`breakdownByType`, `byCategoryTotals`, `byCardTotals`,
`upcomingInvoices`, `monthlyForecast`, `monthLabel`), R2
(`OccurrenceListSkeleton`).

**Changes vs. current implementation — this is the largest single-file
change in this plan; the implementer has latitude on internal structure
as long as the behavior below is met:**

1. **Data source change:** drop `useSummary` for this page. Fetch the
   current month's occurrences via `useOccurrences(monthRange(month))`
   (reuse or duplicate `/mes`'s `monthRange` helper — your call whether to
   extract it into `@contai/domain` now, given the M3 minor finding from
   the earlier final review flagged this duplication; extracting it is a
   reasonable in-scope cleanup here since you're already touching two
   files that both need it, but don't block on it if it adds risk). Also
   fetch upcoming pending occurrences via a second `useOccurrences` call:
   `{ from: toISODate(new Date()), status: 'pending' }` (no `to` bound —
   `occurrenceFiltersSchema.to` is optional).
2. **Summary tiles (2×2 grid):** compute `total` = sum of the month
   occurrences' amounts (active only — reuse `splitRealizedForecast(...).total`
   or a simple reduce, your call), plus `breakdownByType(monthOccurrences)`
   for `invoicesTotal`/`recurringTotal`/`installmentsTotal`. Render 4
   tiles: "Gastos no mês" / "Faturas atuais" / "Recorrentes" /
   "Parcelamentos", matching
   `../swift-spend/src/routes/_authenticated/relatorios.tsx`'s tile grid
   layout (`grid grid-cols-2 gap-3`, `rounded-2xl border border-border
   bg-card p-3` per tile). Show `<SummaryCardsSkeleton>`-equivalent
   (reuse the `Skeleton` primitive inline, following the swift-spend
   source's pattern — you don't need a separately exported component for
   this one since it's page-local) while loading.
3. **Category breakdown:** `byCategoryTotals(monthOccurrences)`, remapped
   to names via a `categoryId → name` lookup map (same `remapByName`-style
   pattern already in this file — keep it, adapt to work on the new
   `AmountSlice[]` shape instead of a `Record<string, number>`). Render as
   **tappable** cards with a progress bar (`w-full` button, `h-2
   rounded-full bg-secondary` track + `bg-primary` fill sized by
   `(slice.total / max) * 100`, `max = categorySlices[0]?.total ?? 1`),
   matching the swift-spend source. Tapping toggles a `categoryFilter`
   state; when set, render `<OccurrenceList>` (or `<OccurrenceListSkeleton>`
   while occurrences are loading — they won't be, since this reuses
   already-fetched data) filtered to that category beneath the breakdown,
   wired to the existing `<OccurrenceSheet>` selection state this page
   should now also carry (it didn't have one before — add
   `selected`/`setSelected` state and an `<OccurrenceSheet>` at the bottom
   of the page, matching `/inicio` and `/mes`'s existing pattern).
4. **Card breakdown:** `byCardTotals(monthOccurrences)`, remapped to names
   the same way, rendered as a simple list row per card with
   `<CardVisual size="xs" color={card.color} />` (look up the full card
   object by id from `useCards()`'s data for the color) next to the name
   and amount.
5. **Upcoming invoices:** `upcomingInvoices(upcomingOccurrences, new
   Date())` (the second fetch from step 1), remapped `cardId → name`, one
   row per entry: card name, due date (format via a simple
   `${day}/${month}` from the ISO string — no new domain helper needed for
   this, inline it), total, and — when `forecastTotal > 0` — a secondary
   "previsto" note, matching the swift-spend source's row layout. Cap the
   list at 6 entries (`.slice(0, 6)`), matching the source.
6. **Next-3-months forecast:** `monthlyForecast(upcomingOccurrences,
   addMonths-equivalent-of-next-month, 3)` — note `@contai/domain` doesn't
   have an `addMonths` helper; compute the "next month" start date inline
   as `new Date(now.getFullYear(), now.getMonth() + 1, 1)` (same technique
   already used in `/mes`'s `monthRange`, no new domain function needed
   for a one-off inline date construction). Render each month's
   `monthLabel` + total in a simple divided list, matching the source.
7. Keep the `useCards`/`useCategories` `isError` handling already in this
   file (from the earlier final-review fix) — extend it to also account
   for the two new `useOccurrences` calls' error states if you judge it
   worth the added complexity; a single shared "algo deu errado" message
   covering all of this page's queries is an acceptable simplification if
   per-query messages get unwieldy — your call, but don't silently drop
   error visibility that already exists.

**Step 1: Edit the page**

**Step 2: Verify manually**

```bash
pnpm --filter web typecheck
```

Golden path: 4 summary tiles show correct totals; tapping a category
toggles a drill-down list of just that category's occurrences; card
breakdown shows card-colored icons; upcoming invoices and next-3-months
sections render (may be empty if no recurring/installment data exists in
the seeded dev DB — that's a valid empty state, not a bug).

**Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/relatorios" $(git diff --name-only | grep -E "domain/src/date.ts$" || true)
git commit -m "feat: rework /relatorios with type breakdown, drill-down, upcoming invoices, and forecast"
```

(The `date.ts` addition in the commit command above only applies if you
extracted `monthRange` into `@contai/domain` per Step 1's note — omit it
otherwise; don't force an empty addition.)

---

### Task 6 (R6): `/ajustes` rework

**Files:**
- Edit: `apps/web/src/app/(app)/ajustes/page.tsx`

**Depends on:** none from this plan (R1/R2 not needed here) — can run in
parallel with R3-R5 if you want to reorder, but this plan dispatches tasks
sequentially per the SDD process regardless.

**Changes vs. current implementation:**
1. Restructure into `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`
   (`apps/web/src/components/ui/tabs.tsx` already exists) with two tabs:
   "Cartões" and "Categorias" — matching
   `../swift-spend/src/routes/_authenticated/ajustes.tsx`'s
   `grid-cols-2` tab list.
2. **Inline forms, not dialogs:** remove the `Dialog`+"Adicionar
   cartão"/"Adicionar categoria" trigger-button pattern. Render
   `<CardForm onSuccess={...}>` directly at the top of the "Cartões" tab
   content (always visible, not gated behind a button) and
   `<CategoryForm onSuccess={...}>` at the top of "Categorias" —
   `CardForm`/`CategoryForm` (`apps/web/src/components/forms/`) already
   work standalone (they're plain `<form>` elements with no
   Dialog-specific dependency) — no changes needed to those two
   components themselves. On success, the mutation hooks already
   `invalidateQueries` and toast (from Task 35) — `onSuccess` can be a
   no-op or reset-focused callback now that there's no dialog to close;
   your call on whether `onSuccess` still needs to do anything meaningful.
3. **Live in-place recolor:** under each existing card's info in the list
   (not the create-form), add a compact `<CardColorPicker>` wired to
   `onChange={(color) => updateCard.mutate({ id: card.id, data: { color } })}`
   — `CardColorPicker` (`apps/web/src/components/app/card-color-picker.tsx`)
   is already exactly the right shape for this (`value`/`onChange`,
   already renders a clickable swatch row), reuse it directly rather than
   building swift-spend's separate inline `ColorPicker` function. You'll
   need `useUpdateCard()` alongside the existing `useDeleteCard()` already
   imported in this file.
4. Keep the C1 fix from the earlier final-review round intact: the
   "Remover" button must still be hidden for the 7 default categories
   (`DEFAULT_CATEGORIES` from `@contai/domain`) — don't regress this while
   restructuring the categories tab.
5. Keep the I3 theme-toggle fix intact (the `useSyncExternalStore`-based
   theme state) — it's independent of this task's Tabs restructure, just
   don't accidentally remove it while moving JSX around.
6. Add loading skeletons for both lists (`useCards`/`useCategories`
   `isLoading`) — a simple 2-3 row `Skeleton` block per list, page-local,
   no new shared component needed (these lists are only used here).
7. Keep the sign-out button outside/below the Tabs, matching both the
   current implementation and the swift-spend source's placement.

**Step 1: Edit the page**

**Step 2: Verify manually**

```bash
pnpm --filter web typecheck
```

Golden path: switch between Cartões/Categorias tabs; add a card via the
now-inline form; tap a color swatch on an *existing* card and confirm it
recolors without opening any dialog; confirm a default category still has
no "Remover" button and a user-created one does; toggle theme, reload,
confirm it's still applied (I3 regression check).

**Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/ajustes"
git commit -m "feat: rework /ajustes with tabs, inline forms, and live card recolor"
```

---

## Finishing

Once R1-R6 are committed and green:

- Run `pnpm turbo run typecheck lint test` at the repo root, and
  `pnpm --filter web build`, as the final gate (same commands used to
  close out the original Section G plan).
- Dispatch a final whole-branch review scoped to **this plan's diff only**
  (R1's BASE through R6's HEAD) — the original Section G work (Tasks
  0/31.5/32-35 plus its fix wave) was already reviewed and is not back in
  scope here.
- Continue with `superpowers:finishing-a-development-branch` once this
  plan's own review is clean — the branch's integration decision (merge /
  PR / keep) was already being decided when this plan's scope was added;
  resume that conversation after this plan closes out.

## Verification

- `pnpm --filter web typecheck` green after every web task; `pnpm turbo
  run typecheck test --filter=@contai/domain` green after R1.
- `pnpm --filter web build` and `pnpm --filter web lint` clean at the end.
- Manual dev-server walk of all four pages per each task's verify step.
