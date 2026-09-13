# Bolso MVP Implementation Plan — Section E2: Web hooks (tRPC client + use-cases)

> Companion doc: the tRPC infra, services layer, and routers this section calls into live
> in [`section-e1-api-trpc.md`](./section-e1-api-trpc.md) — same task numbers (18-24), so
> "Task 19" here (cards hooks) pairs with "Task 19" there (cards service + router).
>
> Replaces the combined tRPC doc previously at `section-e-api-trpc.md` and,
> transitively, the REST version previously at `section-e-api-hooks.md` — both
> never built, both deleted (see git history).

> Part of the full plan. Master checklist and progress tracking: `../2026-09-09-bolso-mvp-implementation.md`. Shared context below is duplicated from that file so this section can be worked on standalone.

**Goal:** Give `apps/web` type-safe access to the `appRouter` procedures from
`section-e1-api-trpc.md` — a client Provider wired into the existing `@tanstack/react-query`
v5 `QueryClient`, and one `use-*.ts` hook file per resource, consumed by Section F's forms
and Section G's pages.

**Architecture:** `apps/web/src/lib/trpc/client.ts` exposes `useTRPC()` (via
`createTRPCContext<AppRouter>()`); `apps/web/src/lib/trpc/provider.tsx` builds the
`httpBatchLink`-based `TRPCClient` and wraps children in `TRPCProvider`, mounted inside
the existing `QueryProvider`. Each hook file wraps `trpc.<resource>.<procedure>` in
`useQuery`/`useMutation` via `@trpc/tanstack-react-query`'s `queryOptions()`/
`mutationOptions()`, keeping the exact hook names/signatures Section F/G's components
already reference (`useCards()`, `useCreateExpense()`, etc.).

**Tech Stack:** `@trpc/client` v11, `@trpc/tanstack-react-query` v11, `@tanstack/react-query` v5, `sonner`.

**Spec:** `docs/superpowers/specs/2026-09-11-monorepo-trpc-migration-design.md`

## Global Constraints

- Every hook calls through `useTRPC()` — never construct a raw `fetch` call or a second tRPC client.
- Hook input field names match the service's zod schema exactly (camelCase, e.g. `closingDay`/`dueDay`/`creditLimit`, not the old REST plan's snake_case body) — Section F's forms should use these field names directly.
- Mutation hooks: `onSuccess` invalidates the relevant `queryKey()`(s) and shows a `sonner` success toast; `onError` shows `error.message` in a toast.
- Files: lowercase-with-hyphens. Named exports only.
- End of every task below: if it's the first task to create a structurally complex folder (`apps/web/src/lib/trpc/`, `apps/web/src/hooks/`), add a short `CLAUDE.md` in that folder. Refresh root `CLAUDE.md` if the task changes the top-level structure.

---

## Task 18: tRPC client wiring — `client.ts`, `provider.tsx`, `QueryProvider`

**Files:**
- Create: `apps/web/src/lib/trpc/client.ts`, `apps/web/src/lib/trpc/provider.tsx`
- Edit: `apps/web/src/providers/query-provider.tsx`, `apps/web/package.json`

**Interfaces:**
- Consumes: `type AppRouter` from `@contai/api` (`section-e1-api-trpc.md` Task 18).
- Produces: `useTRPC()` + `TRPCProvider` (`client.ts`), `TRPCReactProvider` (`provider.tsx`) — consumed by every hook task below.

- [ ] **Step 1: Add tRPC client dependencies**

`apps/web/package.json` — add to `dependencies`: `"@trpc/client": "^11"`, `"@trpc/tanstack-react-query": "^11"`, `"superjson": "^2"` (must match the version `packages/api` uses — check `packages/api/package.json`).

Note: `packages/api/src/trpc.ts` (`section-e1-api-trpc.md` Task 18) configures
`transformer: superjson` on its `initTRPC` instance — this was a final-review fix
added after that plan section's own execution, closing a bug where `Date` columns
(`createdAt`, `deletedAt`, occurrence dates, etc.) would silently serialize to plain
strings over the HTTP fetch-adapter route while `AppRouter`'s inferred types still
claimed `Date`. The client link below MUST configure the same transformer, or every
response will fail to deserialize those fields correctly.

- [ ] **Step 2: Write `apps/web/src/lib/trpc/client.ts`**

```ts
'use client'

import { createTRPCContext } from '@trpc/tanstack-react-query'
import type { AppRouter } from '@contai/api'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()
```

- [ ] **Step 3: Write `apps/web/src/lib/trpc/provider.tsx`**

```tsx
'use client'

import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import superjson from 'superjson'
import type { AppRouter } from '@contai/api'
import { TRPCProvider } from './client'

export function TRPCReactProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient()
    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
        }),
    )

    return (
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            {children}
        </TRPCProvider>
    )
}
```

- [ ] **Step 4: Wire `TRPCReactProvider` inside `QueryProvider`**

Edit `apps/web/src/providers/query-provider.tsx`:

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'
import { TRPCReactProvider } from '@/lib/trpc/provider'

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <TRPCReactProvider>{children}</TRPCReactProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
```

- [ ] **Step 5: Verify**

```bash
pnpm install
pnpm --filter web typecheck
pnpm --filter web dev
```

Expected: app boots with the Provider mounted. There are no hooks yet to exercise — the
first real call happens in Task 19.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add tRPC client Provider wired into QueryProvider"
```

---

## Task 19: `use-cards.ts`

**Files:**
- Create: `apps/web/src/hooks/use-cards.ts`, `apps/web/src/hooks/CLAUDE.md`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `cards` router (`section-e1-api-trpc.md` Task 19).
- Produces: `useCards()`, `useCreateCard()`, `useUpdateCard()`, `useDeleteCard()` — consumed by Section F Task 27 (card form) and Section G Task 35 (`/ajustes`).

- [ ] **Step 1: Write `apps/web/src/hooks/use-cards.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCards() {
    const trpc = useTRPC()
    return useQuery(trpc.cards.list.queryOptions())
}

export function useCreateCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão criado')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useUpdateCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão atualizado')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteCard() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.cards.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.cards.list.queryKey() })
                toast.success('Cartão removido')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

`useUpdateCard()` takes `{ id, data }` (matching the router's `input`). `useCreateCard().mutate(values)` matches `cardInputSchema` directly (camelCase `closingDay`/`dueDay`/`creditLimit`) — Section F's card form should use these field names directly.

- [ ] **Step 2: Write `apps/web/src/hooks/CLAUDE.md`**

```markdown
# src/hooks

React Query hooks over `@trpc/tanstack-react-query` — one file per resource
(`use-<resource>.ts`), named `use<Resource>()` for lists, `useCreate<Resource>()`/
`useUpdate<Resource>()`/`useDelete<Resource>()` for mutations. Every mutation
invalidates the resource's `queryKey()` on success and toasts via `sonner`. Never call
`fetch` directly here — always go through `useTRPC()`.
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Log in via the browser. In a scratch client component, call `useCreateCard().mutate({ name: 'Nubank', closingDay: 10, dueDay: 20, color: '#8A2BE2' })` and confirm a row appears via `useCards()`. Confirm an unauthenticated request to `/api/trpc/cards.list` (no session cookie) returns a tRPC `UNAUTHORIZED` error, not data.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add cards hooks"
```

---

## Task 20: `use-categories.ts`

**Files:**
- Create: `apps/web/src/hooks/use-categories.ts`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `categories` router (`section-e1-api-trpc.md` Task 20).
- Produces: `useCategories()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` — consumed by Section F Task 26 (quick-add/parser context) and Section G Task 35 (`/ajustes`).

- [ ] **Step 1: Write `apps/web/src/hooks/use-categories.ts`**

`@trpc/tanstack-react-query`'s `queryOptions()` already dedupes concurrent identical requests through TanStack Query's own request deduplication (same `queryKey` in flight only fires once) — no hand-rolled single-flight guard needed.

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCategories() {
    const trpc = useTRPC()
    return useQuery(trpc.categories.list.queryOptions())
}

export function useCreateCategory() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.categories.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
                toast.success('Categoria criada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useUpdateCategory() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.categories.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
                toast.success('Categoria atualizada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteCategory() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.categories.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.categories.list.queryKey() })
                toast.success('Categoria removida')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```

Call `useCategories()` twice in a row (e.g. two mounted components, or refetch) and confirm the 7 defaults seed once with no `categories_user_name_unique` violation (check via `pnpm --filter @contai/db exec drizzle-kit studio` if needed).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add categories hooks"
```

---

## Task 21: `use-merchants.ts`

**Files:**
- Create: `apps/web/src/hooks/use-merchants.ts`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `merchants` router (`section-e1-api-trpc.md` Task 21).
- Produces: `useMerchants()` returning merchants ordered by `usageCount` desc — consumed by Section F Task 16/26 (`ParserContext` wiring inside `quick-add.tsx`).

- [ ] **Step 1: Write `apps/web/src/hooks/use-merchants.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useMerchants() {
    const trpc = useTRPC()
    return useQuery(trpc.merchants.list.queryOptions())
}
```

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```

Confirm `useMerchants()` returns `[]` for a fresh user with no 500/`UNAUTHORIZED` surprises.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add merchants hook"
```

---

## Task 22: `use-create-expense.ts`

**Files:**
- Create: `apps/web/src/hooks/use-create-expense.ts`

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `expenses` router (`section-e1-api-trpc.md` Task 22).
- Produces: `useCreateExpense()` — consumed by Section F Task 26 (quick-add) and Task 27 (manual dialog).

- [ ] **Step 1: Write `apps/web/src/hooks/use-create-expense.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'

export function useCreateExpense() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.expenses.create.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.merchants.list.queryKey() })
                toast.success('Despesa registrada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

Note: this hook references `trpc.occurrences.list` and `trpc.reports.summary`, which don't
exist until Tasks 23-24 in this doc (their backing routers land in `section-e1-api-trpc.md`
Tasks 23-24 too). Write this hook now with only the `merchants.list` invalidation, and add
the other two invalidation lines back in as one-line additions once Tasks 23/24 land — or
execute Tasks 22-24 together before running `pnpm --filter web typecheck` if working
task-by-task with review checkpoints, prefer the former (incremental, always-green).

Note: `createExpenseInputSchema`'s `purchaseDate` field (`section-e1-api-trpc.md` Task 22)
is `z.string().date()` — a calendar-date-only string (`'YYYY-MM-DD'`), not a full timestamp.
This was changed post-implementation (a final-review fix) specifically because a
`z.coerce.date()` timestamp caused a confirmed off-by-one-day bug once it round-tripped
through the domain layer's local-timezone date math, on the exact "register an expense in
15 seconds" evening-use path this app targets. Whatever builds the actual expense form
(Section F's quick-add/manual dialog, which consumes this hook) must send `purchaseDate` as
a plain `'YYYY-MM-DD'` string — e.g. from a date picker, format with the calendar date only,
never `new Date().toISOString()` or similar, which would send a full timestamp and fail the
schema.

- [ ] **Step 2: Verify manually**

```bash
pnpm dev
```

Test all three branches: single (`{ amount: 50, description: 'mercado', purchaseDate: '2026-09-09', type: 'single' }` → 1 occurrence row), installment (same + `type: 'installment', installments: 3` → 3 rows, `installmentNumber` 1-3, `occurrenceDate`s one calendar month apart), recurring (`type: 'recurring', frequency: 'monthly'` → 12 rows one month apart, including the start date).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add create-expense hook"
```

---

## Task 23: `use-occurrences.ts`

**Files:**
- Create: `apps/web/src/hooks/use-occurrences.ts`
- Edit: `apps/web/src/hooks/use-create-expense.ts` (add the deferred `occurrences.list` invalidation)

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `occurrences` router (`section-e1-api-trpc.md` Task 23).
- Produces: `useOccurrences(filters)`, `useUpdateOccurrence()`, `useDeleteOccurrence()` — consumed by Section F Task 28 (`occurrence-list.tsx`) and Task 29 (`occurrence-sheet.tsx`).

- [ ] **Step 1: Write `apps/web/src/hooks/use-occurrences.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import type { OccurrenceFilters } from '@contai/api'

export function useOccurrences(filters: OccurrenceFilters) {
    const trpc = useTRPC()
    return useQuery(trpc.occurrences.list.queryOptions(filters))
}

export function useUpdateOccurrence() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.occurrences.update.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                toast.success('Ocorrência atualizada')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}

export function useDeleteOccurrence() {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    return useMutation(
        trpc.occurrences.delete.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
                queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })
                toast.success('Ocorrência removida')
            },
            onError: (error) => toast.error(error.message),
        }),
    )
}
```

`OccurrenceFilters` needs to be exported from `@contai/api` (re-export it from
`packages/api/src/index.ts`, pointing at `services/occurrences-service.ts`'s
`OccurrenceFilters` type — add this one-line re-export as part of Step 1). Both mutation
hooks reference `trpc.reports.summary` (Task 24) — same deferred-typecheck note as Task 22
applies; omit the `reports.summary` invalidation line until Task 24 lands if working
task-by-task, then add it back.

- [ ] **Step 2: Add the deferred `occurrences.list` invalidation to `use-create-expense.ts`**

Edit `apps/web/src/hooks/use-create-expense.ts`, adding the line noted in Task 22 Step 1:

```ts
                queryClient.invalidateQueries({ queryKey: trpc.occurrences.list.queryKey() })
```

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

Reuse the installment expense from Task 22's verification. `useOccurrences({ status: 'pending' })` → confirm all 3 rows. `useUpdateOccurrence().mutate({ id: <2nd occurrence id>, scope: 'future', data: { status: 'paid' } })` → confirm installments 2 and 3 flip to paid, installment 1 stays pending. `useDeleteOccurrence().mutate({ id: <2nd occurrence id>, scope: 'occurrence' })` → confirm it disappears from `useOccurrences()`, but the row still exists in `expense_installments` with `deletedAt` set (soft delete, confirm via `drizzle-kit studio`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add occurrences hooks"
```

---

## Task 24: `use-summary.ts`

**Files:**
- Create: `apps/web/src/hooks/use-summary.ts`
- Edit: `apps/web/src/hooks/use-create-expense.ts`, `apps/web/src/hooks/use-occurrences.ts` (add the deferred `reports.summary` invalidations)

**Interfaces:**
- Consumes: `useTRPC` (Task 18); `reports` router (`section-e1-api-trpc.md` Task 24).
- Produces: `useSummary(month)` — consumed by Section G Task 32 (`/inicio`) and Task 34 (`/relatorios`).

- [ ] **Step 1: Write `apps/web/src/hooks/use-summary.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useSummary(month: string) {
    const trpc = useTRPC()
    return useQuery(trpc.reports.summary.queryOptions({ month }))
}
```

- [ ] **Step 2: Fill in the deferred `reports.summary` invalidations**

Edit `apps/web/src/hooks/use-create-expense.ts` and `apps/web/src/hooks/use-occurrences.ts` to add/uncomment the `queryClient.invalidateQueries({ queryKey: trpc.reports.summary.queryKey() })` lines noted in Tasks 22-23.

- [ ] **Step 3: Verify manually**

```bash
pnpm dev
```

`useSummary('2026-09')` → confirm the shape matches `summarizeMonth`'s return type and totals match what Task 22's verification created.

Run the full battery once all of Tasks 18-24 in both `section-e1-api-trpc.md` and this doc are done: `pnpm turbo run typecheck lint test && pnpm --filter web build`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add summary hook"
```
