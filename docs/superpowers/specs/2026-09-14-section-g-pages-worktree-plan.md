# Section G Pages — Worktree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bolso MVP's Section G — the four leaf pages (`/inicio`,
`/mes`, `/relatorios`, `/ajustes`) that consume Section F's already-built
components and the tRPC hooks in `apps/web/src/hooks/` — implemented in an
isolated git worktree, off `develop`, so this work doesn't mix with anything
else.

**Why this doc exists instead of executing `section-g-pages.md` directly:**
that file was written 2026-09-09, *before* the monorepo/tRPC migration
(`docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`) and
before Section F's real components existed. Its code assumes a REST API
(`apiClient.get('/api/reports/summary?...')`, `queryKeys`) and
`src/lib/finance/*` imports that no longer exist, references a
`typeFilter` the current `occurrences.list` procedure doesn't support, and
assumes `createCardSchema`/`createCategorySchema` exist under those names
when they don't exist at all yet. This doc rewrites every task's code in
full against the actual current source — verified by reading
`apps/web/src/hooks/*.ts`, `apps/web/src/components/app/*.tsx`,
`packages/api/src/services/*.ts`, `packages/api/src/index.ts`,
`packages/domain/src/{dashboard,date,money}.ts`,
`packages/domain/src/schemas/expense-schema.ts`,
`packages/db/src/schema/domain.ts`, and `apps/web/src/app/(app)/layout.tsx`
directly. `section-g-pages.md` itself is left unedited; this doc is the one
to actually execute.

**Confirmed prerequisite state (2026-09-14):** Sections A–F are merged into
`develop` (PR #14, `feature/f-ui-components` → `develop`). All eight Section F
components exist and match their documented props exactly: `QuickAdd`,
`ManualExpenseDialog`, `OccurrenceList`/`OccurrenceRow`, `OccurrenceSheet`,
`MonthSwitcher`, `SummaryTiles`, `CardVisual`, `CardColorPicker`. All six
resource hooks exist in `apps/web/src/hooks/`: `use-cards.ts`,
`use-categories.ts`, `use-merchants.ts`, `use-create-expense.ts`,
`use-occurrences.ts` (exports `OccurrenceRow` type), `use-summary.ts`. No
`/inicio`, `/mes`, `/relatorios`, `/ajustes` routes exist yet — this plan
creates all four. `apps/web/src/components/forms/` has only `expense-form.tsx`
— `card-form.tsx`/`category-form.tsx` don't exist. `apps/web/src/lib/trpc/server.ts`
exports `getServerCaller()` but nothing consumes it — **out of scope for this
plan** (see "Architecture decision" below).

**Architecture decision (locked in during brainstorming, not up for
re-litigation in this plan):** all four pages stay fully client components
(`'use client'`), fetching through the existing hooks — matching Section F's
precedent exactly, not introducing an RSC/client split. `getServerCaller()`
stays unused for a future pass; using it here would need cache-seeding infra
(`initialData` on the hooks, or a `dehydrate`/`HydrationBoundary` +
`createTRPCOptionsProxy` setup) that doesn't exist anywhere in this codebase
yet, for pages that need client state — `useSearchParams`, dialog/filter
state — regardless of where the initial fetch happens.

**Tech Stack:** Next.js App Router, `@tanstack/react-query` v5 +
`@trpc/tanstack-react-query` (via `useTRPC()`/the hooks), `@contai/domain`
(pure business logic + zod schemas), `@contai/api` (tRPC types only, from
`apps/web`), react-hook-form + `@hookform/resolvers/zod`, shadcn/ui,
tailwind-merge, lucide-react, sonner.

**Source spec:** `docs/superpowers/plans/2026-09-09-bolso-mvp-implementation/section-g-pages.md`
(task list and design intent — this doc supersedes its code blocks with
current, correct ones), `docs/superpowers/specs/2026-09-09-bolso-mvp-design.md`,
`docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`,
`docs/superpowers/specs/2026-09-14-section-f-ui-components-worktree-plan.md`
(sibling doc for Section F, same rewrite pattern).

## Global Constraints

- Files: lowercase-with-hyphens. Always named exports, never `export default`
  except `page.tsx`.
- Every UI component: `className={twMerge('base-classes', className)}`,
  `data-slot="<name>"` on the root element, icon-only buttons need
  `aria-label`, icons use explicit `size-*` classes.
- No hardcoded colors — only tokens from `apps/web/src/app/globals.css`.
- TypeScript: never `React.FC`, never `any`; type-only imports; props extend
  `ComponentProps<'tag'>` where relevant.
- Never redeclare a zod schema that already exists — import it from
  `@contai/domain` (client-safe: zero dependency on `better-auth`/`@contai/db`).
  A schema needed by a client form that currently only lives in
  `packages/api/src/services/*` must be *moved* into `@contai/domain`, not
  imported from `@contai/api` (see Task 35 Step 0).
- A caller-supplied or generated `Date` must go through `@contai/domain`'s
  `toISODate`/`fromISODate`/`monthKey` — never a bare `Date`/`.toISOString()`/
  `new Date(str)`.
- Pages render inside `apps/web/src/app/(app)/layout.tsx`'s shell, which
  already wraps `{children}` in `mx-auto w-full max-w-lg px-4 pt-6` (with
  `pb-28` on the *outer* wrapping div, to clear the fixed `BottomNav`) — page
  content is a bare `<main className="flex flex-col gap-4">`, no
  padding/width/`pb-28` of its own.
- Run `pnpm --filter web typecheck` after every task — must be green before
  the next task starts.

---

### Task 0: Create and verify the worktree

- [ ] **Step 1: Create the worktree off `develop`**

Invoke the `superpowers:using-git-worktrees` skill. If falling back to raw
git (matches this project's existing convention — sibling directory):

```bash
git worktree add -b feature/g-pages ../contai-g-pages develop
```

- [ ] **Step 2: Install dependencies**

```bash
cd ../contai-g-pages
pnpm install
```

- [ ] **Step 3: Sanity-check before starting**

```bash
pnpm turbo run typecheck
```

Expected: passes (pre-existing state — nothing from this plan added yet).

---

### Task 31.5: Global `staleTime`

**Files:**
- Edit: `apps/web/src/providers/query-provider.tsx`

**Why:** every mutation hook (`use-cards.ts`, `use-categories.ts`,
`use-occurrences.ts`, `use-create-expense.ts`) already calls
`queryClient.invalidateQueries()` on success, so correctness-after-write
doesn't depend on `staleTime` — `invalidateQueries` forces a refetch
immediately regardless. Without a `staleTime`, though, every one of these
four pages remounting a shared hook (cards/categories are read on nearly all
of them) triggers a background refetch on every navigation. One global
default fixes that without touching any of the six hook files individually.

- [ ] **Step 1: Add a default `staleTime`**

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'
import { TRPCReactProvider } from '@/lib/trpc/provider'

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000,
                    },
                },
            }),
    )

    return (
        <QueryClientProvider client={queryClient}>
            <TRPCReactProvider>{children}</TRPCReactProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/providers/query-provider.tsx
git commit -m "feat: set a default 30s staleTime for the shared query client"
```

---

### Task 32: `/inicio`

**Files:**
- Create: `apps/web/src/app/(app)/inicio/page.tsx`

**Interfaces:**
- Consumes: `QuickAdd`, `ManualExpenseDialog`, `OccurrenceList`,
  `OccurrenceSheet` (`apps/web/src/components/app/*`); `useOccurrences` +
  `type OccurrenceRow` (`@/hooks/use-occurrences`); `useSummary`
  (`@/hooks/use-summary`); `formatBRL`/`monthKey`/`toISODate` (`@contai/domain`).
- Produces: the home page — leaf, no further tasks consume it.

**Corrections vs. the source plan:** no `apiClient`/`queryKeys` — use
`useSummary(month)`. `formatBRL`/date helpers come from `@contai/domain`, not
`@/lib/finance/*`. `summary.total` is already a plain `number` (computed by
`@contai/domain`'s `summarizeMonth`, not a passthrough of a numeric DB
column), so no `Number(...)` wrapping needed. Grouping/"today" must use
`toISODate(new Date())`, never `new Date().toISOString().slice(0, 10)` (UTC
midnight, drifts a day from local near a day boundary). No `<main className="p-4">`
wrapper — the layout already supplies padding/width.

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatBRL, monthKey, toISODate } from '@contai/domain'
import { QuickAdd } from '@/components/app/quick-add'
import { ManualExpenseDialog } from '@/components/app/manual-expense-dialog'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Button } from '@/components/ui/button'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useSummary } from '@/hooks/use-summary'

export default function InicioPage() {
    const searchParams = useSearchParams()
    const shouldFocus = searchParams.get('focus') === 'quick-add'
    const [manualOpen, setManualOpen] = useState(false)
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    const today = toISODate(new Date())
    const month = monthKey(new Date())

    const { data: summary } = useSummary(month)
    const { data: todayOccurrences = [] } = useOccurrences({ from: today, to: today })

    return (
        <main className="flex flex-col gap-4">
            <h1 className="font-display text-2xl font-semibold text-foreground">
                {summary ? formatBRL(summary.total) : '—'}
            </h1>
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

- [ ] **Step 2: Verify manually**

```bash
pnpm --filter web typecheck
pnpm dev
```

Golden path: land on `/inicio` via the bottom-nav `+`, confirm the quick-add
is focused, type an expense, press Enter, confirm it appears under "Hoje"
and the total updates. Edge case: with zero expenses ever created, confirm
`OccurrenceList`'s built-in empty state ("Nenhuma despesa encontrada.") shows
instead of crashing.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/inicio"
git commit -m "feat: add /inicio page with quick-add and today's expenses"
```

---

### Task 33: `/mes`

**Files:**
- Create: `apps/web/src/app/(app)/mes/page.tsx`

**Interfaces:**
- Consumes: `MonthSwitcher`, `OccurrenceList`, `OccurrenceSheet`
  (`apps/web/src/components/app/*`); `useOccurrences` (`@/hooks/use-occurrences`);
  `useCategories`/`useCards` (`@/hooks/use-categories`, `@/hooks/use-cards`);
  shadcn `Select`, `Input`; `monthKey`/`fromISODate`/`toISODate`
  (`@contai/domain`).
- Produces: the month page — leaf.

**Corrections vs. the source plan:** drop the `typeFilter` the old plan
described — `occurrenceFiltersSchema` (`packages/api/src/services/occurrences-service.ts`)
only has `from`/`to`/`q`/`categoryId`/`cardId`/`status`, no `type`; there's no
backend support for filtering by expense type and adding it is out of scope
for a pages-only section. `useOccurrences`'s filter type comes from
`OccurrenceFilters` (re-exported from `@contai/api`), which the hook already
types its parameter as — no need to import it separately in the page.

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useState } from 'react'
import { monthKey, fromISODate, toISODate } from '@contai/domain'
import { MonthSwitcher } from '@/components/app/month-switcher'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useCategories } from '@/hooks/use-categories'
import { useCards } from '@/hooks/use-cards'

function monthRange(month: string) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 0)
    return { from: toISODate(start), to: toISODate(end) }
}

export default function MesPage() {
    const [month, setMonth] = useState(monthKey(new Date()))
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>()
    const [cardFilter, setCardFilter] = useState<string>()
    const [statusFilter, setStatusFilter] = useState<'pending' | 'paid' | 'cancelled'>()
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    const { data: categories = [] } = useCategories()
    const { data: cards = [] } = useCards()
    const { from, to } = monthRange(month)
    const { data: occurrences = [] } = useOccurrences({
        from,
        to,
        q: search || undefined,
        categoryId: categoryFilter,
        cardId: cardFilter,
        status: statusFilter,
    })

    return (
        <main className="flex flex-col gap-4">
            <MonthSwitcher month={month} onChange={setMonth} />
            <Input
                placeholder="Buscar por descrição"
                aria-label="Buscar despesas"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger aria-label="Categoria">
                        <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={cardFilter} onValueChange={setCardFilter}>
                    <SelectTrigger aria-label="Cartão">
                        <SelectValue placeholder="Cartão" />
                    </SelectTrigger>
                    <SelectContent>
                        {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                                {card.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger aria-label="Status">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <OccurrenceList occurrences={occurrences} showDateHeaders onSelect={setSelected} />
            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
```

Note: `fromISODate` is imported but unused above if `monthRange` only builds
`Date`s from `year`/`month` numbers — remove the import if the linter flags
it, or use it if a different month-boundary approach is preferred. Keep
`toISODate` for converting the computed range boundaries back to strings for
the `occurrences.list` query.

- [ ] **Step 2: Verify manually**

```bash
pnpm --filter web typecheck
pnpm dev
```

Golden path: navigate to a month with known expenses, confirm they're
grouped by date header. Edge case: filter by a category with zero matches,
confirm the empty state shows; switch months via `MonthSwitcher`, confirm a
new `/api/trpc` batch request fires (Network tab) with updated `from`/`to`.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/mes"
git commit -m "feat: add /mes page with month navigation, search, and filters"
```

---

### Task 34: `/relatorios`

**Files:**
- Create: `apps/web/src/app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `SummaryTiles`, `MonthSwitcher` (`apps/web/src/components/app/*`);
  `useSummary` (`@/hooks/use-summary`); `useCategories`/`useCards` (to
  resolve ids to names); `monthKey` (`@contai/domain`).
- Produces: the reports page — leaf.

**Corrections vs. the source plan:** no `apiClient`/`queryKeys` — use
`useSummary(month)`, which returns `{ total, byCategory, byCard }` already
keyed by category/card **id** (`packages/domain/src/dashboard.ts`'s
`summarizeMonth`). `SummaryTiles` renders whatever keys it's given as labels
**verbatim** — it does no id→name lookup itself — so this page must build
the lookup maps and remap before passing the props in, exactly as the
original plan intended.

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useState } from 'react'
import { monthKey } from '@contai/domain'
import { SummaryTiles } from '@/components/app/summary-tiles'
import { MonthSwitcher } from '@/components/app/month-switcher'
import { useSummary } from '@/hooks/use-summary'
import { useCategories } from '@/hooks/use-categories'
import { useCards } from '@/hooks/use-cards'

function remapByName(byId: Record<string, number>, lookup: Record<string, string>) {
    return Object.fromEntries(Object.entries(byId).map(([id, amount]) => [lookup[id] ?? id, amount]))
}

export default function RelatoriosPage() {
    const [month, setMonth] = useState(monthKey(new Date()))
    const { data: summary } = useSummary(month)
    const { data: categories = [] } = useCategories()
    const { data: cards = [] } = useCards()

    const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]))
    const cardNames = Object.fromEntries(cards.map((c) => [c.id, c.name]))

    return (
        <main className="flex flex-col gap-4">
            <MonthSwitcher month={month} onChange={setMonth} />
            <SummaryTiles
                total={summary?.total ?? 0}
                byCategory={remapByName(summary?.byCategory ?? {}, categoryNames)}
                byCard={remapByName(summary?.byCard ?? {}, cardNames)}
            />
        </main>
    )
}
```

- [ ] **Step 2: Verify manually**

```bash
pnpm --filter web typecheck
pnpm dev
```

Golden path: view a month with known data, confirm totals match and
category/card **names** show (not raw UUIDs). Edge case: a month with zero
occurrences shows `R$ 0,00` and empty category/card sections without
crashing.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/relatorios"
git commit -m "feat: add /relatorios page with monthly aggregations"
```

---

### Task 35: `/ajustes` (+ new domain schemas + new forms)

**Files:**
- Create: `packages/domain/src/schemas/card-schema.ts`
- Create: `packages/domain/src/schemas/category-schema.ts`
- Edit: `packages/domain/src/index.ts`
- Edit: `packages/domain/CLAUDE.md`
- Edit: `packages/api/src/services/cards-service.ts`
- Edit: `packages/api/src/services/categories-service.ts`
- Create: `apps/web/src/components/forms/card-form.tsx`
- Create: `apps/web/src/components/forms/category-form.tsx`
- Create: `apps/web/src/app/(app)/ajustes/page.tsx`

**Interfaces:**
- Consumes: `cardInputSchema`/`categoryInputSchema` (newly moved to
  `@contai/domain` by this task); `useCards`/`useCreateCard`/`useUpdateCard`/
  `useDeleteCard`, `useCategories`/`useCreateCategory`/`useUpdateCategory`/
  `useDeleteCategory`; `CardVisual`/`CardColorPicker`; `authClient`
  (`@/lib/auth-client`).
- Produces: the settings page — leaf.

**Corrections vs. the source plan:** `createCardSchema`/`createCategorySchema`
don't exist under those names anywhere. The real schemas —
`cardInputSchema`/`updateCardInputSchema` and
`categoryInputSchema`/`updateCategoryInputSchema` — currently live *inside*
`packages/api/src/services/{cards,categories}-service.ts`, not re-exported
from `@contai/api`. Per this repo's established rule (`packages/domain/CLAUDE.md`,
already enforced for `createExpenseInputSchema`), a client form must never
import a runtime value from `@contai/api` — it transitively pulls in
`better-auth`/`@contai/db`. So Step 0 below moves both schemas into
`@contai/domain`, exactly mirroring how `expense-schema.ts` already works,
before either form is written.

- [ ] **Step 0a: Move `cardInputSchema` into `@contai/domain`**

Create `packages/domain/src/schemas/card-schema.ts`:

```ts
import { z } from 'zod'

export const cardInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    closingDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
    creditLimit: z.number().positive().nullable().optional(),
    color: z.string().min(1),
})
export type CardInput = z.infer<typeof cardInputSchema>

export const updateCardInputSchema = cardInputSchema.partial().extend({ active: z.boolean().optional() })
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>
```

Edit `packages/api/src/services/cards-service.ts` — remove the schema
definitions, import them instead:

```ts
import { cardInputSchema, updateCardInputSchema, type CardInput, type UpdateCardInput } from '@contai/domain'
```

(Keep every other line — `listCards`/`createCard`/`updateCard`/`deleteCard`
— exactly as-is; only the schema source changes.)

- [ ] **Step 0b: Move `categoryInputSchema` into `@contai/domain`**

Create `packages/domain/src/schemas/category-schema.ts`:

```ts
import { z } from 'zod'

export const categoryInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    icon: z.string().max(40).nullable().optional(),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>

export const updateCategoryInputSchema = categoryInputSchema.partial()
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>
```

Edit `packages/api/src/services/categories-service.ts` similarly — remove
the local schema definitions, import from `@contai/domain`.

- [ ] **Step 0c: Re-export both from the domain barrel**

Edit `packages/domain/src/index.ts`, add after the existing schema exports:

```ts
export * from './schemas/card-schema'
export * from './schemas/category-schema'
```

- [ ] **Step 0d: Document the new schemas**

Edit `packages/domain/CLAUDE.md`'s `schemas/` bullet to also mention
`card-schema.ts` (`cardInputSchema`) and `category-schema.ts`
(`categoryInputSchema`) alongside `auth-schema.ts`/`expense-schema.ts`, same
rationale (shared between the tRPC services and the client forms below).

- [ ] **Step 0e: Verify the move**

```bash
pnpm turbo run typecheck
```

Expected: green — this is a pure relocation, no behavior change.

- [ ] **Step 0f: Commit the schema move separately**

```bash
git add packages/domain packages/api/src/services/cards-service.ts packages/api/src/services/categories-service.ts
git commit -m "refactor: move card/category schemas into @contai/domain"
```

- [ ] **Step 1: Write `apps/web/src/components/forms/card-form.tsx`**

Follows `expense-form.tsx`'s established pattern: `useWatch({ control, name })`
per watched field (not destructured `watch`), `Select`s driven by
`value`/`onValueChange` + `setValue`, native inputs via `register` with
`valueAsNumber: true` for numeric fields.

```tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { cardInputSchema, type CardInput } from '@contai/domain'
import { useCreateCard, useUpdateCard } from '@/hooks/use-cards'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CardVisual } from '@/components/app/card-visual'
import { CardColorPicker } from '@/components/app/card-color-picker'

export interface CardFormProps {
    id?: string
    defaultValues?: Partial<CardInput>
    onSuccess: () => void
}

export function CardForm({ id, defaultValues, onSuccess }: CardFormProps) {
    const createCard = useCreateCard()
    const updateCard = useUpdateCard()

    const {
        register,
        handleSubmit,
        control,
        setValue,
        formState: { errors },
    } = useForm<CardInput>({
        resolver: zodResolver(cardInputSchema),
        defaultValues: {
            name: '',
            closingDay: 1,
            dueDay: 10,
            creditLimit: null,
            color: 'orange',
            ...defaultValues,
        },
    })

    const name = useWatch({ control, name: 'name' })
    const color = useWatch({ control, name: 'color' })

    function onSubmit(values: CardInput) {
        if (id) {
            updateCard.mutate({ id, data: values }, { onSuccess })
        } else {
            createCard.mutate(values, { onSuccess })
        }
    }

    return (
        <form data-slot="card-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <CardVisual size="lg" color={color} name={name} />

            <div className="flex flex-col gap-1">
                <label htmlFor="name">Nome</label>
                <Input id="name" {...register('name')} />
                {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
            </div>

            <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1">
                    <label htmlFor="closingDay">Dia de fechamento</label>
                    <Input id="closingDay" type="number" {...register('closingDay', { valueAsNumber: true })} />
                    {errors.closingDay && <span className="text-sm text-destructive">{errors.closingDay.message}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                    <label htmlFor="dueDay">Dia de vencimento</label>
                    <Input id="dueDay" type="number" {...register('dueDay', { valueAsNumber: true })} />
                    {errors.dueDay && <span className="text-sm text-destructive">{errors.dueDay.message}</span>}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor="creditLimit">Limite (opcional)</label>
                <Input id="creditLimit" type="number" step="0.01" {...register('creditLimit', { valueAsNumber: true })} />
            </div>

            <div className="flex flex-col gap-1">
                <label>Cor</label>
                <CardColorPicker value={color} onChange={(value) => setValue('color', value)} />
            </div>

            <Button type="submit" disabled={createCard.isPending || updateCard.isPending}>
                Salvar
            </Button>
        </form>
    )
}
```

- [ ] **Step 2: Write `apps/web/src/components/forms/category-form.tsx`**

```tsx
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { categoryInputSchema, type CategoryInput } from '@contai/domain'
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface CategoryFormProps {
    id?: string
    defaultValues?: Partial<CategoryInput>
    onSuccess: () => void
}

export function CategoryForm({ id, defaultValues, onSuccess }: CategoryFormProps) {
    const createCategory = useCreateCategory()
    const updateCategory = useUpdateCategory()

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<CategoryInput>({
        resolver: zodResolver(categoryInputSchema),
        defaultValues: { name: '', ...defaultValues },
    })

    function onSubmit(values: CategoryInput) {
        if (id) {
            updateCategory.mutate({ id, data: values }, { onSuccess })
        } else {
            createCategory.mutate(values, { onSuccess })
        }
    }

    return (
        <form data-slot="category-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <label htmlFor="name">Nome</label>
                <Input id="name" {...register('name')} />
                {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
            </div>
            <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                Salvar
            </Button>
        </form>
    )
}
```

- [ ] **Step 3: Write `apps/web/src/app/(app)/ajustes/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { useCards, useDeleteCard } from '@/hooks/use-cards'
import { useCategories, useDeleteCategory } from '@/hooks/use-categories'
import { CardVisual } from '@/components/app/card-visual'
import { CardForm } from '@/components/forms/card-form'
import { CategoryForm } from '@/components/forms/category-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'

export default function AjustesPage() {
    const router = useRouter()
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const deleteCard = useDeleteCard()
    const deleteCategory = useDeleteCategory()

    const [cardDialogOpen, setCardDialogOpen] = useState(false)
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
    const [dark, setDark] = useState(() => typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark')

    function toggleTheme(checked: boolean) {
        setDark(checked)
        document.documentElement.classList.toggle('dark', checked)
        localStorage.setItem('theme', checked ? 'dark' : 'light')
    }

    async function handleSignOut() {
        await authClient.signOut()
        router.push('/login')
    }

    return (
        <main className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium text-foreground">Cartões</h2>
                {cards.map((card) => (
                    <div key={card.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <CardVisual size="sm" color={card.color} name={card.name} />
                            <span className="text-foreground">{card.name}</span>
                        </div>
                        <Button variant="ghost" onClick={() => deleteCard.mutate({ id: card.id })}>
                            Remover
                        </Button>
                    </div>
                ))}
                <Button variant="secondary" onClick={() => setCardDialogOpen(true)}>
                    Adicionar cartão
                </Button>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium text-foreground">Categorias</h2>
                {categories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{category.name}</span>
                        <Button variant="ghost" onClick={() => deleteCategory.mutate({ id: category.id })}>
                            Remover
                        </Button>
                    </div>
                ))}
                <Button variant="secondary" onClick={() => setCategoryDialogOpen(true)}>
                    Adicionar categoria
                </Button>
            </section>

            <section className="flex items-center justify-between">
                <span className="text-foreground">Modo escuro</span>
                <Switch checked={dark} onCheckedChange={toggleTheme} />
            </section>

            <Button variant="destructive" onClick={handleSignOut}>
                Sair
            </Button>

            <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo cartão</DialogTitle>
                    </DialogHeader>
                    <CardForm onSuccess={() => setCardDialogOpen(false)} />
                </DialogContent>
            </Dialog>

            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova categoria</DialogTitle>
                    </DialogHeader>
                    <CategoryForm onSuccess={() => setCategoryDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </main>
    )
}
```

- [ ] **Step 4: Verify manually**

```bash
pnpm --filter web typecheck
pnpm dev
```

Golden path: create a card with a chosen color, confirm the `lg` preview
updates live before submit and the card appears in the list afterward with
the right color. Edge case: delete a category referenced by an existing
occurrence, confirm the FK `on delete set null` lets the delete succeed and
the occurrence's `categoryId` becomes null rather than erroring. Toggle the
theme switch, reload, confirm it persisted.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/forms apps/web/src/app/\(app\)/ajustes
git commit -m "feat: add /ajustes page with cards/categories CRUD and theme toggle"
```

---

## Finishing

Once Tasks 0/31.5/32–35 are committed and green on `feature/g-pages`:

- Run `pnpm turbo run typecheck lint test` at the repo root as a final gate.
- Check off Section G's per-step boxes in `section-g-pages.md` and the
  Section G row in the master plan
  (`docs/superpowers/plans/2026-09-09-bolso-mvp-implementation.md`).
- Use `superpowers:finishing-a-development-branch` to decide integration —
  likely a PR from `feature/g-pages` into `develop`, matching the
  `feature/f-ui-components` → `develop` precedent.

## Verification

- `pnpm --filter web typecheck` passes after each task and at the end.
- `pnpm --filter web build` and `pnpm --filter web lint` clean.
- `pnpm turbo run typecheck lint test` clean at the repo root before opening
  the PR.
- Manual dev-server walk of all four pages per each task's verify step
  above, plus the bottom-nav `+` → `/inicio?focus=quick-add` → autofocus
  flow (Task 31 from Section F, deferred here since `/inicio` didn't exist
  until now).
